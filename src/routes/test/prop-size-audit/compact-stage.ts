export const HAND_ORBIT = 150;
export const MIN_FAN_BLEND = 0;
export const MAX_FAN_BLEND = 1;
export const DEFAULT_FAN_BLEND = 0.5;
export const AUTHORED_FAN_SPAN = 300;
export const AUTHORED_FAN_HEIGHT = 239.4;
export const AUTHORED_BIG_FAN_SPAN = 600;
export const AUTHORED_BIG_FAN_HEIGHT = 567.4;

export interface FanLandingMetrics {
  blend: number;
  propScale: number;
  stageScale: number;
  compactOrbit: number;
  scaledFanSpan: number;
  scaledFanHeight: number;
  inwardFanReach: number;
  oppositeHandDistance: number;
  landingError: number;
}

export function clampFanBlend(value: number): number {
  return Math.min(MAX_FAN_BLEND, Math.max(MIN_FAN_BLEND, value));
}

export function fanLandingMetrics(
  requestedBlend: number,
  fanSpan = AUTHORED_FAN_SPAN,
  bigFanSpan = AUTHORED_BIG_FAN_SPAN,
  handOrbit = HAND_ORBIT
): FanLandingMetrics {
  const blend = clampFanBlend(requestedBlend);
  const bigEquivalentScale = bigFanSpan / fanSpan;
  const propScale = bigEquivalentScale + (1 - bigEquivalentScale) * blend;
  const scaledFanSpan = fanSpan * propScale;
  const stageScale = scaledFanSpan / (handOrbit * 4);
  const compactOrbit = handOrbit * stageScale;
  const scaledFanHeight = AUTHORED_FAN_HEIGHT * propScale;
  const inwardFanReach = scaledFanSpan / 2;
  const oppositeHandDistance = compactOrbit * 2;

  return {
    blend,
    propScale,
    stageScale,
    compactOrbit,
    scaledFanSpan,
    scaledFanHeight,
    inwardFanReach,
    oppositeHandDistance,
    landingError: inwardFanReach - oppositeHandDistance,
  };
}
