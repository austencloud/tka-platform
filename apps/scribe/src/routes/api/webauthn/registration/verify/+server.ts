import type { RequestHandler } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import {
  verifyRegistrationResponse,
  type VerifiedRegistrationResponse,
} from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/types";
import admin from "firebase-admin";
import { requireFirebaseUser } from "$lib/server/auth/requireFirebaseUser";
import { getWebAuthnRP } from "$lib/server/webauthn/webauthnConfig";
import {
  toStoredPasskey,
  upsertPasskey,
} from "$lib/server/webauthn/passkeysStore";

const CHALLENGE_COOKIE = "tka_webauthn_reg_challenge";

export const POST: RequestHandler = async (event) => {
  try {
    const user = await requireFirebaseUser(event);
    const { rpID, origin } = getWebAuthnRP(event);
    const expectedChallenge = event.cookies.get(CHALLENGE_COOKIE);
    if (!expectedChallenge) {
      return json(
        { error: "Missing registration challenge", code: "missing_challenge" },
        { status: 400 }
      );
    }

    const body = (await event.request.json()) as RegistrationResponseJSON & {
      name?: string;
    };

    const verification: VerifiedRegistrationResponse =
      await verifyRegistrationResponse({
        response: body,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: false,
      });

    if (!verification.verified || !verification.registrationInfo) {
      return json(
        { error: "Passkey registration failed", code: "registration_failed" },
        { status: 400 }
      );
    }

    const { credential } = verification.registrationInfo;

    const stored = toStoredPasskey({
      credentialId: credential.id,
      publicKey: credential.publicKey,
      counter: credential.counter,
      transports: body.response.transports,
      name:
        typeof body.name === "string" ? body.name.trim().slice(0, 64) : null,
    });

    await upsertPasskey(user.uid, {
      ...stored,
      createdAt: admin.firestore.Timestamp.now(),
      lastUsedAt: null,
      name: stored.name ?? null,
    });

    event.cookies.delete(CHALLENGE_COOKIE, { path: "/" });

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
      err instanceof Error ? err.message : "Failed to verify registration";
    return json({ error: message, code }, { status });
  }
};
