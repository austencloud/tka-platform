import type { RequestHandler } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import {
  verifyAuthenticationResponse,
  type VerifiedAuthenticationResponse,
} from "@simplewebauthn/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/types";
import { requireFirebaseUser } from "$lib/server/auth/requireFirebaseUser";
import { getWebAuthnRP } from "$lib/server/webauthn/webauthnConfig";
import {
  getPasskey,
  storedPasskeyToVerificationCredential,
  updatePasskeyCounterAndLastUsed,
} from "$lib/server/webauthn/passkeysStore";
import { createStepUpToken } from "$lib/server/security/stepUpSession";

const CHALLENGE_COOKIE = "tka_webauthn_auth_challenge";
const STEP_UP_COOKIE = "tka_step_up";
const STEP_UP_TTL_SECONDS = 10 * 60;

export const POST: RequestHandler = async (event) => {
  try {
    const user = await requireFirebaseUser(event);
    const { rpID, origin } = getWebAuthnRP(event);
    const expectedChallenge = event.cookies.get(CHALLENGE_COOKIE);
    if (!expectedChallenge) {
      return json(
        {
          error: "Missing authentication challenge",
          code: "missing_challenge",
        },
        { status: 400 }
      );
    }

    const secret = process.env.STEP_UP_COOKIE_SECRET?.trim();
    if (!secret) {
      return json(
        { error: "Server not configured for step-up", code: "missing_secret" },
        { status: 500 }
      );
    }

    const body = (await event.request.json()) as AuthenticationResponseJSON;
    const credentialId = body.id;
    const stored = await getPasskey(user.uid, credentialId);
    if (!stored) {
      return json(
        { error: "Unknown passkey", code: "unknown_credential" },
        { status: 400 }
      );
    }

    const verification: VerifiedAuthenticationResponse =
      await verifyAuthenticationResponse({
        response: body,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: storedPasskeyToVerificationCredential(stored),
        requireUserVerification: false,
      });

    if (!verification.verified || !verification.authenticationInfo) {
      return json(
        { error: "Passkey verification failed", code: "auth_failed" },
        { status: 401 }
      );
    }

    await updatePasskeyCounterAndLastUsed({
      uid: user.uid,
      credentialId: stored.credentialId,
      counter: verification.authenticationInfo.newCounter,
    });

    const token = createStepUpToken({
      uid: user.uid,
      ttlSeconds: STEP_UP_TTL_SECONDS,
      secret,
    });

    event.cookies.set(STEP_UP_COOKIE, token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: event.url.protocol === "https:",
      maxAge: STEP_UP_TTL_SECONDS,
    });
    event.cookies.delete(CHALLENGE_COOKIE, { path: "/" });

    return json({ ok: true, ttlSeconds: STEP_UP_TTL_SECONDS });
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
      err instanceof Error ? err.message : "Failed to verify authentication";
    return json({ error: message, code }, { status });
  }
};
