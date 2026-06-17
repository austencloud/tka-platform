import type { UserRecord } from "firebase-admin/auth";

const STALE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * An anonymous account is stale when it has NO linked provider credential and
 * its last sign-in (or creation) was more than 30 days before `nowMs`.
 */
export function isStaleAnonymousAccount(user: UserRecord, nowMs: number): boolean {
  const isAnonymous = !user.providerData || user.providerData.length === 0;
  if (!isAnonymous) return false;
  const lastActive = Date.parse(
    user.metadata.lastSignInTime || user.metadata.creationTime
  );
  if (Number.isNaN(lastActive)) return false;
  return nowMs - lastActive > STALE_AFTER_MS;
}
