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
