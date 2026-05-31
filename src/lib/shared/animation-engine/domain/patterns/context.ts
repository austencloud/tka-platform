import type { LedColor } from "../types/led-patterns";

export interface TipRelationData {
  readonly x: number;
  readonly y: number;
  readonly propIndex: number;
  readonly tipIndex: number;
}

export interface TipEvaluationContext {
  time: number;
  ledIndex: number;
  totalLeds: number;
  speed: number;
  primaryColor: LedColor;
  secondaryColor: LedColor;
  propIndex: 0 | 1;
  tipIndex: number;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  speedMagnitude: number;
  prevFrameTips: ReadonlyArray<TipRelationData>;
  stepNumber: number;
  totalSteps: number;
}

const WHITE: LedColor = { r: 1, g: 1, b: 1 };
const EMPTY_TIPS: ReadonlyArray<TipRelationData> = [];

/**
 * Pre-allocated context object reused every frame to avoid GC pressure.
 * Call resetContext() then mutate fields before passing to evaluatePattern().
 */
export function createReusableContext(): TipEvaluationContext {
  return {
    time: 0,
    ledIndex: 0,
    totalLeds: 0,
    speed: 1,
    primaryColor: { r: 0, g: 1, b: 0.53 },
    secondaryColor: { ...WHITE },
    propIndex: 0,
    tipIndex: 0,
    x: 0,
    y: 0,
    velocityX: 0,
    velocityY: 0,
    speedMagnitude: 0,
    prevFrameTips: EMPTY_TIPS,
    stepNumber: -1,
    totalSteps: 0,
  };
}
