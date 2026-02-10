/**
 * Centralized admin authorization guard.
 *
 * Verifies the caller is an authenticated Firebase user AND has admin role.
 * Replaces the duplicated isAdmin() pattern across admin endpoints.
 *
 * Usage:
 *   const caller = await requireAdmin(event);
 *   // caller is a FirebaseUser with verified admin role
 */

import type { RequestEvent } from "@sveltejs/kit";
import { error } from "@sveltejs/kit";
import { requireFirebaseUser, type FirebaseUser } from "./requireFirebaseUser";
import { getAdminDb } from "../firebaseAdmin";

export async function requireAdmin(
  event: RequestEvent,
): Promise<FirebaseUser> {
  const caller = await requireFirebaseUser(event);

  const db = getAdminDb();
  const userDoc = await db.collection("users").doc(caller.uid).get();

  if (!userDoc.exists) {
    throw error(403, "Admin access required");
  }

  const data = userDoc.data();
  if (data?.role !== "admin" && data?.isAdmin !== true) {
    throw error(403, "Admin access required");
  }

  return caller;
}
