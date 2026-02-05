import type { RequestEvent } from "@sveltejs/kit";
import { verifyStepUpToken } from "./stepUpSession";

const STEP_UP_COOKIE = "tka_step_up";

export function requireStepUpOrRecentAuth(
  event: RequestEvent,
  params: { uid: string; authTime?: number; maxAgeSeconds?: number }
): void {
  const secret = process.env.STEP_UP_COOKIE_SECRET?.trim() || null;

  const token = event.cookies.get(STEP_UP_COOKIE);
  const claims = secret ? verifyStepUpToken({ token, secret }) : null;

  if (claims?.uid === params.uid) {
    return;
  }

  const maxAgeSeconds = params.maxAgeSeconds ?? 5 * 60;
  const now = Math.floor(Date.now() / 1000);
  const authTime = params.authTime;
  if (typeof authTime === "number" && now - authTime <= maxAgeSeconds) {
    return;
  }

  {
    throw Object.assign(new Error("Step-up verification required"), {
      status: 401,
      code: "step_up_required",
    });
  }
}
