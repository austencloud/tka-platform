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

export function hasAdminClaim(user: FirebaseUser): boolean {
  return user.admin === true || user.isAdmin === true || user.role === "admin";
}

export async function requireAdmin(event: RequestEvent): Promise<FirebaseUser> {
  const caller = await requireFirebaseUser(event);

  if (!hasAdminClaim(caller)) {
    throw error(403, "Admin access required");
  }

  return caller;
}
