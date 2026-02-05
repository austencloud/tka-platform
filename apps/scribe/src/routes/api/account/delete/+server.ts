import type { RequestHandler } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import type admin from "firebase-admin";
import { requireFirebaseUser } from "$lib/server/auth/requireFirebaseUser";
import { getAdminAuth, getAdminDb } from "$lib/server/firebaseAdmin";
import { requireStepUpOrRecentAuth } from "$lib/server/security/requireStepUp";
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from "$lib/server/security/rate-limiter";

const STEP_UP_COOKIE = "tka_step_up";

async function deleteCollection(
  ref: admin.firestore.CollectionReference,
  batchSize = 400
) {
  let hasMore = true;
  while (hasMore) {
    const snap = await ref.limit(batchSize).get();
    if (snap.empty) {
      hasMore = false;
      continue;
    }
    const batch = ref.firestore.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

export const POST: RequestHandler = async (event) => {
  // Rate limit by IP address
  const clientIp = event.getClientAddress();
  const rateCheck = checkRateLimit(
    `delete-account:${clientIp}`,
    RATE_LIMITS.ACCOUNT_SENSITIVE
  );
  if (!rateCheck.allowed) {
    return rateLimitResponse(rateCheck.resetAt);
  }

  try {
    const user = await requireFirebaseUser(event);
    requireStepUpOrRecentAuth(event, {
      uid: user.uid,
      authTime: user.authTime,
    });

    const db = getAdminDb();
    const auth = getAdminAuth();

    const userDoc = db.collection("users").doc(user.uid);

    // Best-effort cleanup of user-scoped subcollections (extend as needed)
    await deleteCollection(userDoc.collection("notifications"));

    await userDoc.delete().catch(() => {});

    await auth.deleteUser(user.uid);

    // Require re-verify for subsequent destructive actions
    event.cookies.delete(STEP_UP_COOKIE, { path: "/" });

    return json({ ok: true });
  } catch (err: unknown) {
    const status =
      typeof err === "object" && err && "status" in err
        ? Number((err as { status: unknown }).status)
        : 500;
    const code =
      typeof err === "object" && err && "code" in err
        ? String((err as { code: unknown }).code)
        : "internal_error";
    const message =
      err instanceof Error ? err.message : "Failed to delete account";
    return json({ error: message, code }, { status });
  }
};
