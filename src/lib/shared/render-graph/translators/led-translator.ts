/**
 * LedIntent → LedPassPayload translator.
 *
 * Pure function: takes the canonical LedIntent from EffectsConfig
 * plus each tip's shaft positions and velocity, emits a backend-neutral
 * LedPassPayload. Pattern evaluation happens here; the backend only
 * renders the resulting segment array.
 */

import type { LedIntent } from "$lib/shared/effects/domain/EffectsConfig";
import type { LedPassPayload, LedTipState, LedSegment } from "../domain/led-pass";

export interface LedTranslationContext {
  tips: Array<{
    tipId: string;
    /** Ordered positions along the prop shaft, base→tip, in NDC. */
    shaftPositions: Array<[number, number]>;
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

  return {
    tips,
    bloomRadius: intent.brightness * 8,
    bloomIntensity: intent.brightness * 0.6,
  };
}

function buildTip(
  tip: LedTranslationContext["tips"][number],
  intent: LedIntent,
  ctx: LedTranslationContext,
): LedTipState {
  const color = pickColor(tip.tipId, intent);
  const total = tip.shaftPositions.length;

  const segments: LedSegment[] = tip.shaftPositions.map((pos, i) => ({
    position: pos,
    color,
    brightness: ctx.patternFn(i, total, ctx.elapsedSeconds, intent.patternSpeed),
  }));

  return {
    tipId: tip.tipId,
    segments,
    brightness: intent.brightness,
    motionStreak: tip.velocity > STREAK_VELOCITY_THRESHOLD,
    streakDecayPerSecond: STREAK_DECAY_PER_SECOND,
  };
}

function pickColor(
  tipId: string,
  intent: LedIntent,
): [number, number, number] {
  if (intent.colorMode === "unified") {
    return hexToRgb(intent.primaryColor);
  }
  // per-hand / prop-matched: blue tip → primary, red tip → secondary
  return tipId === "blue"
    ? hexToRgb(intent.primaryColor)
    : hexToRgb(intent.secondaryColor);
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.trim().replace(/^#/, "");
  if (normalized.length !== 6) return [1, 1, 1];
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return [1, 1, 1];
  return [r / 255, g / 255, b / 255];
}
