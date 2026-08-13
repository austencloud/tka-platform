export type AutumnQualityTier = "low" | "medium" | "high";

export interface AutumnQualityConfig {
  leafCount: number;
  sporeCount: number;
  fireflyCount: number;
  wispCount: number;
  /**
   * Contact shadows from the moon key. Off on `low` because the extra depth
   * pass is the first thing a weak GPU cannot afford.
   */
  shadows: boolean;
  /**
   * Shadow map resolution. The camera spans 40m to cover tree-length shadows,
   * so 1024 gives ~26 texels/m — enough for soft contact, visibly stepped on
   * trunk edges. High doubles it.
   */
  shadowMapSize: number;
}

const CONFIGS: Record<AutumnQualityTier, AutumnQualityConfig> = {
  high: {
    leafCount: 140,
    sporeCount: 60,
    fireflyCount: 36,
    wispCount: 5,
    shadows: true,
    shadowMapSize: 2048,
  },
  medium: {
    leafCount: 90,
    sporeCount: 40,
    fireflyCount: 24,
    wispCount: 4,
    shadows: true,
    shadowMapSize: 1024,
  },
  low: {
    leafCount: 50,
    sporeCount: 20,
    fireflyCount: 12,
    wispCount: 3,
    shadows: false,
    shadowMapSize: 1024,
  },
};

export function getAutumnQualityConfig(
  tier: AutumnQualityTier
): AutumnQualityConfig {
  return CONFIGS[tier];
}
