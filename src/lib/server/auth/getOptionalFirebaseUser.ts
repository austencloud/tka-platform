import type { RequestEvent } from "@sveltejs/kit";
import { requireFirebaseUser, type FirebaseUser } from "./requireFirebaseUser";

/**
 * Resolve a verified Firebase identity when the request carries one. Scanning
 * remains public; an absent, expired, or malformed session simply records an
 * anonymous discovery instead of breaking the physical card.
 */
export async function getOptionalFirebaseUser(
  event: RequestEvent
): Promise<FirebaseUser | null> {
  const authorization = event.request.headers.get("authorization");
  if (!authorization) return null;

  try {
    return await requireFirebaseUser(event);
  } catch {
    return null;
  }
}
