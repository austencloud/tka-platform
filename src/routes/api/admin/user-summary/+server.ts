import type { RequestHandler } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { requireAdmin } from "$lib/server/auth/requireAdmin";
import { getAdminAuth, getAdminDb } from "$lib/server/firebaseAdmin";
import { RATE_LIMITS } from "$lib/server/security/rate-limiter";
import { withRateLimit } from "$lib/server/security/withRateLimit";
import { logAdminAction } from "$lib/server/security/audit-logger";
import type { UserRecord } from "firebase-admin/auth";
import type { AdminUserAccountSummary } from "$lib/features/admin/services/types";

function isAnonymousAccount(user: UserRecord): boolean {
  return user.providerData.length === 0 && !user.email;
}

async function listAllAuthUsers(): Promise<UserRecord[]> {
  const users: UserRecord[] = [];
  let pageToken: string | undefined;

  do {
    const page = await getAdminAuth().listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);

  return users;
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

    const [authUsers, profiles] = await Promise.all([
      listAllAuthUsers(),
      getAdminDb().collection("users").select("isAnonymous").get(),
    ]);

    const registeredAuthUsers = authUsers.filter(
      (user) => !isAnonymousAccount(user)
    );
    const profileIds = new Set(profiles.docs.map((profile) => profile.id));
    const registeredProfiles = profiles.docs.filter(
      (profile) => profile.data().isAnonymous !== true
    ).length;
    const anonymousProfiles = profiles.size - registeredProfiles;

    const summary: AdminUserAccountSummary = {
      totalAuthAccounts: authUsers.length,
      registeredAccounts: registeredAuthUsers.length,
      anonymousAccounts: authUsers.length - registeredAuthUsers.length,
      totalProfiles: profiles.size,
      registeredProfiles,
      anonymousProfiles,
      missingRegisteredProfiles: registeredAuthUsers.filter(
        (user) => !profileIds.has(user.uid)
      ).length,
    };

    await logAdminAction({
      uid: caller.uid,
      action: "user_summary_query",
      target: "all-users",
      metadata: {
        registeredAccounts: summary.registeredAccounts,
        missingRegisteredProfiles: summary.missingRegisteredProfiles,
      },
      ip: event.getClientAddress(),
    });

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
