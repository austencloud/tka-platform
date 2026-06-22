// Pending credential linking — resolves "account exists with a different
// credential".
//
// The classic OAuth collision: a user already has an account on email X (via
// Google or email/password), then tries to sign in with Facebook whose email is
// also X. Firebase refuses the sign-in with
// auth/account-exists-with-different-credential and hands back a *pending*
// Facebook credential. We can't link it yet — the user isn't signed in.
//
// Resolution that works even with Firebase email-enumeration protection on
// (which makes fetchSignInMethodsForEmail return nothing, so we can't probe the
// existing provider): stash the pending credential, ask the user to sign in with
// whatever method they already have, then auto-link the stashed credential onto
// that account on the next successful sign-in. After that, Facebook works
// normally for them.
//
// State is module-level (one in-flight collision per tab), mirroring how the
// rest of the auth layer keeps singletons. It clears on consume, on sign-out,
// and on any link failure so a stale credential can't loop.

import { linkWithCredential, type AuthCredential, type User } from "firebase/auth";

interface PendingLink {
  credential: AuthCredential;
  /** Email the pending credential belongs to, if Firebase reported it. */
  email: string | null;
  /** e.g. "facebook.com" — what we'll link onto the existing account. */
  providerId: string;
}

let pending: PendingLink | null = null;

/** Stash a credential pulled off an account-exists collision error. */
export function stashPendingLink(
  credential: AuthCredential,
  email: string | null
): void {
  pending = { credential, email, providerId: credential.providerId };
}

export function hasPendingLink(): boolean {
  return pending !== null;
}

/** Email of the in-flight pending link, for guidance copy ("sign in as …"). */
export function getPendingLinkEmail(): string | null {
  return pending?.email ?? null;
}

/** providerId of the in-flight pending link, for guidance copy. */
export function getPendingLinkProviderId(): string | null {
  return pending?.providerId ?? null;
}

export function clearPendingLink(): void {
  pending = null;
}

/**
 * Called after any successful sign-in. If a credential is stashed and the
 * account we just signed into is the one it belongs to, link it on so the
 * provider works from now on.
 *
 * Returns the linked providerId on success, else null. Only a genuine email
 * MISMATCH leaves the stash intact (a different account signed in — keep waiting
 * for the right one); every terminal outcome clears it.
 */
export async function consumePendingLinkForUser(
  user: User
): Promise<string | null> {
  if (!pending) return null;
  const { credential, email, providerId } = pending;

  // Different account than the credential's email → not ours to link. Keep the
  // stash so the correct account can still claim it later.
  if (email && user.email && email.toLowerCase() !== user.email.toLowerCase()) {
    return null;
  }

  // Already linked (e.g. a double auth-state fire) — nothing to do.
  if (user.providerData.some((p) => p.providerId === providerId)) {
    clearPendingLink();
    return null;
  }

  try {
    await linkWithCredential(user, credential);
    clearPendingLink();
    return providerId;
  } catch {
    // Expired/invalid pending credential — drop it so we don't retry forever.
    clearPendingLink();
    return null;
  }
}
