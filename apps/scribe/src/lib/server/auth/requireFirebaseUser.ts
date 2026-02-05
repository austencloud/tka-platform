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
  } catch {
    throw Object.assign(new Error("Invalid or expired token"), {
      status: 401,
      code: "invalid_token",
    });
  }
}
