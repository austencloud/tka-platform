import type { RequestEvent } from "@sveltejs/kit";
import { getAdminAuth } from "../firebaseAdmin";

export type FirebaseUser = {
  uid: string;
  email?: string;
  name?: string;
  authTime?: number;
};

function getBearerToken(event: RequestEvent): string | null {
  const header = event.request.headers.get("authorization")?.trim() ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

export async function requireFirebaseUser(
  event: RequestEvent
): Promise<FirebaseUser> {
  const token = getBearerToken(event);
  if (!token) {
    throw Object.assign(new Error("Missing Authorization Bearer token"), {
      status: 401,
      code: "missing_token",
    });
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    const displayName = (decoded as unknown as { displayName?: unknown })
      .displayName;
    return {
      uid: decoded.uid,
      email: decoded.email,
      name:
        typeof decoded.name === "string"
          ? decoded.name
          : typeof displayName === "string"
            ? displayName
            : undefined,
      authTime:
        typeof decoded.auth_time === "number" ? decoded.auth_time : undefined,
    };
  } catch (verifyErr: unknown) {
    // Surface the real reason instead of collapsing every failure into one opaque
    // string. firebase-admin throws FirebaseAuthError with a `.code` such as
    // auth/id-token-expired, auth/id-token-revoked, or auth/argument-error
    // (project mismatch / malformed token). Without this, "Invalid or expired
    // token" hides whether the user just needs to re-auth or the server admin
    // SDK is misconfigured.
    const firebaseCode =
      typeof verifyErr === "object" && verifyErr && "code" in verifyErr
        ? String((verifyErr as { code: unknown }).code)
        : undefined;
    const detail =
      verifyErr instanceof Error ? verifyErr.message : String(verifyErr);
    console.error(
      `[requireFirebaseUser] verifyIdToken failed (code=${firebaseCode ?? "unknown"}): ${detail}`,
    );

    const expired = firebaseCode === "auth/id-token-expired";
    throw Object.assign(
      new Error(expired ? "ID token expired — sign in again" : "Invalid or expired token"),
      {
        status: 401,
        code: "invalid_token",
        firebaseCode,
      },
    );
  }
}
