/**
 * Admin endpoint to fetch a user's Firebase Auth data.
 * Only accessible by admins for the user preview feature.
 */
import type { RequestHandler } from "@sveltejs/kit";
import { json, error } from "@sveltejs/kit";
import { requireAdmin } from "$lib/server/auth/requireAdmin";
import { getAdminAuth } from "$lib/server/firebaseAdmin";
import { RATE_LIMITS } from "$lib/server/security/rate-limiter";
import { withRateLimit } from "$lib/server/security/withRateLimit";
import { logAdminAction } from "$lib/server/security/audit-logger";

export interface UserAuthData {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  photoURL: string | null;
  phoneNumber: string | null;
  disabled: boolean;
  providers: Array<{
    providerId: string;
    uid: string;
    displayName: string | null;
    email: string | null;
    phoneNumber: string | null;
    photoURL: string | null;
  }>;
  metadata: {
    creationTime: string | undefined;
    lastSignInTime: string | undefined;
  };
  // MFA info
  multiFactor: {
    enrolledFactors: Array<{
      uid: string;
      displayName: string | null;
      factorId: string;
      enrollmentTime: string | undefined;
    }>;
  } | null;
}

export const GET: RequestHandler = async (event) => {
  try {
    const caller = await requireAdmin(event);

    const blocked = await withRateLimit(event, RATE_LIMITS.ADMIN, "user", caller.uid);
    if (blocked) return blocked;

    const targetUid = event.params.uid;
    if (!targetUid) {
      throw error(400, "User ID required");
    }

    // Fetch target user's auth data using Admin SDK
    const auth = getAdminAuth();
    const userRecord = await auth.getUser(targetUid);

    const response: UserAuthData = {
      uid: userRecord.uid,
      email: userRecord.email ?? null,
      emailVerified: userRecord.emailVerified,
      displayName: userRecord.displayName ?? null,
      photoURL: userRecord.photoURL ?? null,
      phoneNumber: userRecord.phoneNumber ?? null,
      disabled: userRecord.disabled,
      providers: userRecord.providerData.map((p) => ({
        providerId: p.providerId,
        uid: p.uid,
        displayName: p.displayName ?? null,
        email: p.email ?? null,
        phoneNumber: p.phoneNumber ?? null,
        photoURL: p.photoURL ?? null,
      })),
      metadata: {
        creationTime: userRecord.metadata.creationTime,
        lastSignInTime: userRecord.metadata.lastSignInTime,
      },
      multiFactor: userRecord.multiFactor
        ? {
            enrolledFactors: userRecord.multiFactor.enrolledFactors.map(
              (f) => ({
                uid: f.uid,
                displayName: f.displayName ?? null,
                factorId: f.factorId,
                enrollmentTime: f.enrollmentTime,
              })
            ),
          }
        : null,
    };

    logAdminAction({
      uid: caller.uid,
      action: "user_auth_query",
      target: targetUid,
      ip: event.getClientAddress(),
    });

    return json(response);
  } catch (err: unknown) {
    // Handle Firebase "user not found" error
    if (
      typeof err === "object" &&
      err &&
      "code" in err &&
      (err as { code: string }).code === "auth/user-not-found"
    ) {
      throw error(404, "User not found");
    }

    // Re-throw SvelteKit errors
    if (typeof err === "object" && err && "status" in err) {
      throw err;
    }

    console.error("[admin/user-auth] Error:", err);
    throw error(500, "Failed to fetch user auth data");
  }
};
