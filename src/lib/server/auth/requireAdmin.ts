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
import { getAdminAuth } from "$lib/server/firebaseAdmin";

export function hasAdminClaim(user: {
  admin?: unknown;
  isAdmin?: unknown;
  role?: unknown;
}): boolean {
  return user.admin === true || user.isAdmin === true || user.role === "admin";
}

export async function requireAdmin(event: RequestEvent): Promise<FirebaseUser> {
  const caller = await requireFirebaseUser(event);
  let liveUser;
  try {
    liveUser = await getAdminAuth().getUser(caller.uid);
  } catch (cause) {
    console.error("[requireAdmin] Failed to resolve live Auth user:", cause);
    throw error(401, "Admin session is no longer valid");
  }

  if (liveUser.disabled) {
    throw error(403, "Admin account is disabled");
  }

  const authenticatedAt = caller.authTime * 1000;
  const tokensValidAfter = Date.parse(liveUser.tokensValidAfterTime ?? "");
  if (
    Number.isFinite(tokensValidAfter) &&
    authenticatedAt > 0 &&
    authenticatedAt <= tokensValidAfter
  ) {
    throw error(401, "Admin session was revoked");
  }

  const liveClaims = liveUser.customClaims ?? {};
  if (!hasAdminClaim(liveClaims)) {
    throw error(403, "Admin access required");
  }

  return caller;
}
