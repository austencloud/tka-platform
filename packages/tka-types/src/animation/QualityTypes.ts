export enum QualityTier {
  HIGH = "high",
  MEDIUM = "medium",
  LOW = "low",
}

export interface QualityHints {
  tier: QualityTier;
  targetSubdivisions: number;
  maxSubdivisionsPerSegment: number;
  glowEnabled: boolean;
  maxDpr: number;
}

export enum DeviceTier {
  HIGH = "high",
  MEDIUM = "medium",
  LOW = "low",
}

export interface QualityAdaptationConfig {
  targetFrameTimeMs: number;
  degradeAfterFrames: number;
  recoverAfterFrames: number;
  recoverThreshold: number;
  minTimeBetweenChangesMs: number;
}

export const QUALITY_TIER_PARAMS: Record<QualityTier, Omit<QualityHints, "tier">> = {
  [QualityTier.HIGH]: {
    targetSubdivisions: 150,
    maxSubdivisionsPerSegment: 10,
    glowEnabled: true,
    maxDpr: Infinity,
  },
  [QualityTier.MEDIUM]: {
    targetSubdivisions: 60,
    maxSubdivisionsPerSegment: 5,
    glowEnabled: false,
    maxDpr: 2.0,
  },
  [QualityTier.LOW]: {
    targetSubdivisions: 20,
    maxSubdivisionsPerSegment: 3,
    glowEnabled: false,
    maxDpr: 1.0,
  },
};
