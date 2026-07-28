import type { RequestEvent } from "@sveltejs/kit";
import { requireFirebaseUser, type FirebaseUser } from "./requireFirebaseUser";

/**
 * Require a durable Firebase account rather than an anonymous guest session.
 * Physical-card issuance creates permanent inventory records and therefore
 * needs an accountable owner.
 */
export async function requireFullFirebaseUser(
  event: RequestEvent
): Promise<FirebaseUser> {
  const caller = await requireFirebaseUser(event);
  if (!caller.signInProvider || caller.signInProvider === "anonymous") {
    throw Object.assign(
      new Error("A full account is required to issue physical cards"),
      { status: 403, code: "full_account_required" }
    );
  }
  return caller;
}
