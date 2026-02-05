import type { RequestHandler } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { requireFirebaseUser } from "$lib/server/auth/requireFirebaseUser";
import { getAdminAuth, getAdminDb } from "$lib/server/firebaseAdmin";
import { requireStepUpOrRecentAuth } from "$lib/server/security/requireStepUp";
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from "$lib/server/security/rate-limiter";

const STEP_UP_COOKIE = "tka_step_up";

function isEmailLike(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
}

export const POST: RequestHandler = async (event) => {
  // Rate limit by IP address
  const clientIp = event.getClientAddress();
  const rateCheck = checkRateLimit(
    `update-email:${clientIp}`,
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

    const body = (await event.request.json()) as { newEmail?: unknown };
    const newEmail =
      typeof body.newEmail === "string" ? body.newEmail.trim() : "";
    if (!isEmailLike(newEmail)) {
      return json(
        { error: "Invalid email address", code: "invalid_email" },
        { status: 400 }
      );
    }

    const auth = getAdminAuth();
    await auth.updateUser(user.uid, { email: newEmail, emailVerified: false });
    await auth.revokeRefreshTokens(user.uid);

    // Best-effort sync to user profile doc
    const db = getAdminDb();
    await db
      .collection("users")
      .doc(user.uid)
      .set({ email: newEmail }, { merge: true })
      .catch(() => {});

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
      err instanceof Error ? err.message : "Failed to update email";
    return json({ error: message, code }, { status });
  }
};
