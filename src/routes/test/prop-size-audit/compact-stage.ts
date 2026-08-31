export const HAND_ORBIT = 150;
export const MIN_STAGE_SCALE = 0.2;
export const MAX_STAGE_SCALE = 1;

export interface CompactStageMetrics {
  stageScale: number;
  compactOrbit: number;
  currentPropToGridRatio: number;
  proposedPropToGridRatio: number;
  ratioDriftPercent: number;
}

export function clampStageScale(value: number): number {
  return Math.min(MAX_STAGE_SCALE, Math.max(MIN_STAGE_SCALE, value));
}

export function matchedStageScale(baseReach: number, bigReach: number): number {
  return clampStageScale(requiredStageScale(baseReach, bigReach));
}

export function requiredStageScale(
  baseReach: number,
  bigReach: number
): number {
  if (baseReach <= 0 || bigReach <= 0) return MAX_STAGE_SCALE;
  return baseReach / bigReach;
}

export function compactStageMetrics(
  baseReach: number,
  bigReach: number,
  stageScale: number
): CompactStageMetrics {
  const safeScale = clampStageScale(stageScale);
  const compactOrbit = HAND_ORBIT * safeScale;
  const currentPropToGridRatio = bigReach / HAND_ORBIT;
  const proposedPropToGridRatio = baseReach / compactOrbit;
  const ratioDriftPercent =
    currentPropToGridRatio > 0
      ? ((proposedPropToGridRatio - currentPropToGridRatio) /
          currentPropToGridRatio) *
        100
      : 0;

  return {
    stageScale: safeScale,
    compactOrbit,
    currentPropToGridRatio,
    proposedPropToGridRatio,
    ratioDriftPercent,
  };
}
