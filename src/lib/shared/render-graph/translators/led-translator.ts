/**
 * LedIntent → LedPassPayload translator.
 *
 * Pure function: takes the canonical LedIntent from EffectsConfig plus each
 * tip's shaft positions, color, and velocity, emits a backend-neutral
 * LedPassPayload. Per-LED color is decided upstream by the LED sampler from
 * the materialized strip pattern; this translator only shapes the payload.
 */

import type { LedIntent } from "$lib/shared/effects/domain/effects-config";
import { ledBrightnessToFloat } from "$lib/shared/animation-engine/domain/types/led-types";
import type { LedPassPayload, LedTipState, LedSegment } from "../domain/led-pass";

export interface LedTranslationContext {
  tips: Array<{
    tipId: string;
    /** Ordered positions along the prop shaft, base→tip, in NDC. */
    shaftPositions: Array<[number, number]>;
    /** RGB 0..1 for this tip's LEDs, sampled from the strip pattern. */
    color: [number, number, number];
    velocity: number;
  }>;
  elapsedSeconds: number;
  /** Pattern function: (segmentIndex, totalSegments, time, speed) → brightness 0..1 */
  patternFn: (index: number, total: number, time: number, speed: number) => number;
}

const STREAK_DECAY_PER_SECOND = 4.0;
const STREAK_VELOCITY_THRESHOLD = 0.01;

export function toLedPassPayload(
  intent: LedIntent,
  context: LedTranslationContext,
): LedPassPayload {
  const tips: LedTipState[] = context.tips.map((tip) =>
    buildTip(tip, intent, context),
  );

  const brightness = ledBrightnessToFloat(intent.look.brightness);
  return {
    tips,
    bloomRadius: brightness * 8,
    bloomIntensity: brightness * 0.6,
  };
}

function buildTip(
  tip: LedTranslationContext["tips"][number],
  intent: LedIntent,
  ctx: LedTranslationContext,
): LedTipState {
  const total = tip.shaftPositions.length;

  const segments: LedSegment[] = tip.shaftPositions.map((pos, i) => ({
    position: pos,
    color: tip.color,
    // Speed is expressed as loops per second, the inverse of cycleDuration.
    brightness: ctx.patternFn(
      i,
      total,
      ctx.elapsedSeconds,
      1 / Math.max(0.001, intent.cycleDuration),
    ),
  }));

  return {
    tipId: tip.tipId,
    segments,
    brightness: ledBrightnessToFloat(intent.look.brightness),
    motionStreak: tip.velocity > STREAK_VELOCITY_THRESHOLD,
    streakDecayPerSecond: STREAK_DECAY_PER_SECOND,
  };
}
