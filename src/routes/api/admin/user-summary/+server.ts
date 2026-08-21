import type { RequestHandler } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { requireAdmin } from "$lib/server/auth/requireAdmin";
import {
  getFirebaseAuthRest,
  type FirebaseAuthRest,
  type FirebaseAuthUser,
} from "$lib/server/auth/firebase-auth-rest";
import {
  fromFirestoreFields,
  getFirestoreRest,
  type FirestoreDocument,
  type FirestoreRest,
} from "$lib/server/firestore/firestore-rest";
import { RATE_LIMITS } from "$lib/server/security/rate-limiter";
import { withRateLimit } from "$lib/server/security/withRateLimit";
import { logAdminAction } from "$lib/server/security/audit-logger";
import type { AdminUserAccountSummary } from "$lib/features/admin/services/types";

function isAnonymousAccount(user: FirebaseAuthUser): boolean {
  return user.providerData.length === 0 && !user.email;
}

async function listAllAuthUsers(
  auth: FirebaseAuthRest
): Promise<FirebaseAuthUser[]> {
  const users: FirebaseAuthUser[] = [];
  let pageToken: string | undefined;

  do {
    const page = await auth.listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);

  return users;
}

async function listAllProfiles(
  firestore: FirestoreRest
): Promise<FirestoreDocument[]> {
  const profiles: FirestoreDocument[] = [];
  let pageToken: string | undefined;

  do {
    const page = await firestore.listDocuments("users", {
      pageSize: 1000,
      pageToken,
      fieldPaths: ["isAnonymous"],
    });
    profiles.push(...page.documents);
    pageToken = page.nextPageToken;
  } while (pageToken);

  return profiles;
}

function documentId(document: FirestoreDocument): string {
  return decodeURIComponent(document.name.split("/").at(-1) ?? "");
}

export const GET: RequestHandler = async (event) => {
  try {
    const caller = await requireAdmin(event);
    const blocked = await withRateLimit(
      event,
      RATE_LIMITS.ADMIN,
      "user",
      caller.uid
    );
    if (blocked) return blocked;

    const platformCredential =
      event.platform?.env?.FIREBASE_SERVICE_ACCOUNT_JSON;
    const [authUsers, profiles] = await Promise.all([
      listAllAuthUsers(getFirebaseAuthRest(platformCredential)),
      listAllProfiles(getFirestoreRest(platformCredential)),
    ]);

    const registeredAuthUsers = authUsers.filter(
      (user) => !isAnonymousAccount(user)
    );
    const profileIds = new Set(profiles.map(documentId));
    const registeredProfiles = profiles.filter(
      (profile) =>
        fromFirestoreFields(profile.fields ?? {}).isAnonymous !== true
    ).length;
    const anonymousProfiles = profiles.length - registeredProfiles;

    const summary: AdminUserAccountSummary = {
      totalAuthAccounts: authUsers.length,
      registeredAccounts: registeredAuthUsers.length,
      anonymousAccounts: authUsers.length - registeredAuthUsers.length,
      totalProfiles: profiles.length,
      registeredProfiles,
      anonymousProfiles,
      missingRegisteredProfiles: registeredAuthUsers.filter(
        (user) => !profileIds.has(user.uid)
      ).length,
    };

    await logAdminAction(
      {
        uid: caller.uid,
        action: "user_summary_query",
        target: "all-users",
        metadata: {
          registeredAccounts: summary.registeredAccounts,
          missingRegisteredProfiles: summary.missingRegisteredProfiles,
        },
        ip: event.getClientAddress(),
      },
      platformCredential
    );

    return json(summary);
  } catch (cause) {
    const status = responseStatus(cause);
    if (status >= 500) {
      console.error("[admin/user-summary] Query failed:", cause);
    }
    return json(
      {
        message:
          status < 500 && cause instanceof Error
            ? cause.message
            : "User counts are temporarily unavailable",
      },
      { status }
    );
  }
};

function responseStatus(cause: unknown): number {
  if (typeof cause !== "object" || cause === null || !("status" in cause)) {
    return 500;
  }
  const status = Number((cause as { status: unknown }).status);
  return Number.isInteger(status) && status >= 400 && status <= 599
    ? status
    : 500;
}
