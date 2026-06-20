export type AccessTier = "guest" | "user" | "premium";

export const ACCESS_TIER_LABELS: Record<AccessTier, string> = {
  guest: "Guest",
  user: "Composer",
  premium: "Scribe",
};

export function resolveAccessTier(
  isAuthenticated: boolean,
  isAnonymous: boolean,
  isPremium: boolean
): AccessTier {
  if (!isAuthenticated || isAnonymous) return "guest";
  if (isPremium) return "premium";
  return "user";
}

/**
 * Tier to show during the brief auth-loading window on a warm reload. Once auth
 * has resolved, use the real tier. While it is still loading, fall back to the
 * last-known tier from the boot snapshot so a signed-in user does not flash as
 * guest. Once auth resolves, callers switch back to the real tier and it
 * reconciles in place.
 */
export function resolveOptimisticAccessTier(
  authLoading: boolean,
  realTier: AccessTier,
  snapshotTier: AccessTier | null
): AccessTier {
  if (!authLoading) return realTier;
  return snapshotTier ?? realTier;
}

/**
 * A "full account" is an authenticated, non-anonymous user. Anonymous guests
 * are authenticated (they have a Firebase uid for their cloud library) but are
 * NOT full accounts — onboarding and account UI must treat them as guests.
 * This is the same distinction resolveAccessTier draws (anon → "guest").
 */
export function isFullAccountUser(
  isAuthenticated: boolean,
  isAnonymous: boolean
): boolean {
  return isAuthenticated && !isAnonymous;
}

export function getMaxBeats(tier: AccessTier): number {
  switch (tier) {
    case "guest":
      return 8;
    case "user":
      return 16;
    case "premium":
      return 64;
  }
}
