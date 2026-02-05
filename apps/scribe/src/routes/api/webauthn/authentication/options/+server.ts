import type { RequestHandler } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { requireFirebaseUser } from "$lib/server/auth/requireFirebaseUser";
import { getWebAuthnRP } from "$lib/server/webauthn/webauthnConfig";
import {
  listPasskeys,
  storedPasskeyToAllowCredential,
} from "$lib/server/webauthn/passkeysStore";

const CHALLENGE_COOKIE = "tka_webauthn_auth_challenge";

export const POST: RequestHandler = async (event) => {
  try {
    const user = await requireFirebaseUser(event);
    const { rpID } = getWebAuthnRP(event);

    const passkeys = await listPasskeys(user.uid);
    if (passkeys.length === 0) {
      return json(
        { error: "No passkeys registered", code: "no_passkeys" },
        { status: 400 }
      );
    }

    const options = await generateAuthenticationOptions({
      rpID,
      timeout: 60_000,
      userVerification: "preferred",
      allowCredentials: passkeys.map((p) => storedPasskeyToAllowCredential(p)),
    });

    event.cookies.set(CHALLENGE_COOKIE, options.challenge, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: event.url.protocol === "https:",
      maxAge: 5 * 60,
    });

    return json(options);
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
      err instanceof Error
        ? err.message
        : "Failed to create authentication options";
    return json({ error: message, code }, { status });
  }
};
