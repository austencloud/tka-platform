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
   * Shadow map resolution. The camera spans 40m to keep the sparse pond-to-owl
   * prop casters inside one stable frustum, so 1024 gives ~26 texels/m for
   * soft contact. High doubles it.
   */
  shadowMapSize: number;
}

const CONFIGS: Record<AutumnQualityTier, AutumnQualityConfig> = {
  high: {
    leafCount: 140,
    sporeCount: 60,
    fireflyCount: 84,
    wispCount: 5,
    shadows: true,
    shadowMapSize: 2048,
  },
  medium: {
    leafCount: 90,
    sporeCount: 40,
    fireflyCount: 60,
    wispCount: 4,
    shadows: true,
    shadowMapSize: 1024,
  },
  low: {
    leafCount: 50,
    sporeCount: 20,
    fireflyCount: 36,
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
