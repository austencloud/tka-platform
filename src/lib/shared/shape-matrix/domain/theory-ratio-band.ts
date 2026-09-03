/**
 * The Theory surface's level ladder — the counterpart of `matrix-turn-band`.
 *
 * Level means the same kind of thing on both surfaces: how fine the vocabulary
 * on the axis gets. The Matrix adds turn values; Theory adds denominators. The
 * ladder is the Farey sequence by order, so each step is the mathematically
 * next-simplest set of ratios rather than an arbitrary cut.
 *
 * Level 1 is not a toy. Order 2 is exactly 0:1, 1:2 and 1:1 — Float, the
 * quarter-turn reduction, and isolation — which is the whole of what TKA turn
 * values can express inside this band. Levels 2 through 4 are what the letters
 * cannot name.
 */
import {
  buildBoundedSpinRatios,
  spinRatioEquals,
  spinRatioKey,
  type SpinRatio,
} from "@vtg/domain";
import type { TurnLevel } from "$lib/shared/create/services/level-turn-values";
import { STATIONARY_RATIO } from "./theory-flower";

/** Farey order per level: every reduced P:Q in [0:1, 1:1] with Q ≤ order. */
export const THEORY_LEVEL_ORDER: Record<TurnLevel, number> = {
  1: 2,
  2: 3,
  3: 5,
  4: 9,
};

export const THEORY_LEVEL_DESCRIPTIONS: Record<
  TurnLevel,
  { name: string; blurb: string }
> = {
  1: { name: "What TKA Names", blurb: "Halves: Float, 1:2, isolation" },
  2: { name: "Thirds", blurb: "Adds 1:3 and 2:3" },
  3: { name: "Fifths", blurb: "Adds quarters and fifths" },
  4: { name: "Through Ninths", blurb: "Every ratio to 1:9, plus 1:0" },
};

/**
 * The ratios an axis may take at a level.
 *
 * The stationary hand joins only at the top. 1:0 sits outside the Farey band
 * entirely — it is the ratio with no hand path at all — so it reads as the
 * far edge of the vocabulary rather than one of its steps.
 */
export function theoryRatiosForLevel(level: TurnLevel): SpinRatio[] {
  const band = buildBoundedSpinRatios(THEORY_LEVEL_ORDER[level]);
  return level === 4 ? [...band, STATIONARY_RATIO] : band;
}

export function clampTheoryRatioToLevel(
  ratio: SpinRatio,
  level: TurnLevel
): SpinRatio {
  const band = theoryRatiosForLevel(level);
  const exact = band.find((candidate) => spinRatioEquals(candidate, ratio));
  if (exact) return exact;

  // Fall to the nearest available value rather than a fixed default: a level
  // change should move the axis a little, not throw the user's place away.
  const target =
    ratio.handCycles === 0 ? 1 : ratio.propRotations / ratio.handCycles;
  let best = band[0] as SpinRatio;
  let bestDistance = Infinity;
  for (const candidate of band) {
    if (candidate.handCycles === 0) continue;
    const distance = Math.abs(
      candidate.propRotations / candidate.handCycles - target
    );
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return best;
}

export function theoryRatioVisibleLabel(ratio: SpinRatio): string {
  return spinRatioKey(ratio);
}

export function theoryRatioSpokenLabel(ratio: SpinRatio): string {
  const key = spinRatioKey(ratio);
  if (ratio.handCycles === 0) return `${key}, stationary hand`;
  if (ratio.propRotations === 0) return `${key}, float`;
  const cycles = ratio.handCycles;
  return `${key}, closes in ${cycles} hand ${cycles === 1 ? "cycle" : "cycles"}`;
}
