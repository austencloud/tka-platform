/**
 * level-turn-values.ts
 *
 * The canonical per-level turn palette — which turn values a hand may carry at
 * each TKA difficulty level. Extracted from `loop-parameter-provider.allocateTurns`
 * (which had it inline) so the generator and the option picker read ONE table
 * instead of two copies that drift.
 *
 * Level 1 = base motions, no turns. Level 2 = whole turns. Level 3 = half turns
 * plus floats. (Ground truth: `LoopParameterProvider.allocateTurns`.)
 */

export type TurnValue = number | "fl";

export const TURN_LEVELS = [1, 2, 3] as const;
export type TurnLevel = (typeof TURN_LEVELS)[number];

const LEVEL_TURN_VALUES: Record<TurnLevel, readonly TurnValue[]> = {
  1: [0],
  2: [0, 1, 2, 3],
  3: [0, 0.5, 1, 1.5, 2, 2.5, 3, "fl"],
};

/** Turn values legal at `level`. Out-of-range levels clamp into 1-3. */
export function turnValuesForLevel(level: number): readonly TurnValue[] {
  return LEVEL_TURN_VALUES[asTurnLevel(level)];
}

export function asTurnLevel(level: number): TurnLevel {
  if (level >= 3) return 3;
  if (level <= 1) return 1;
  return 2;
}

/**
 * The lowest level that permits `value` — used to infer a starting level from
 * turns that were persisted before the level selector existed.
 */
export function levelForTurnValue(value: TurnValue): TurnLevel {
  if (value === "fl") return 3;
  if (value === 0) return 1;
  return Number.isInteger(value) ? 2 : 3;
}

/** The lowest level that permits BOTH hands' current turns. */
export function levelForTurns(blue: TurnValue, red: TurnValue): TurnLevel {
  return Math.max(levelForTurnValue(blue), levelForTurnValue(red)) as TurnLevel;
}

/**
 * Snap a turn value into `level`'s palette. Floats and halves collapse to the
 * nearest legal number when the level drops beneath them; ties round down, so
 * dropping to Level 2 turns 0.5 into 0 rather than inventing a turn the user
 * never asked for.
 */
export function clampTurnToLevel(value: TurnValue, level: number): TurnValue {
  const allowed = turnValuesForLevel(level);
  if (allowed.includes(value)) return value;
  if (value === "fl") return clampTurnToLevel(0, level);

  const numeric = allowed.filter((v): v is number => typeof v === "number");

  let best = 0;
  let bestGap = Number.POSITIVE_INFINITY;
  for (const candidate of numeric) {
    const gap = Math.abs(candidate - value);
    if (gap < bestGap || (gap === bestGap && candidate < best)) {
      best = candidate;
      bestGap = gap;
    }
  }
  return best;
}

/** Display label for a turn button. Floats read "fl", the TKA shorthand. */
export function formatTurnValue(value: TurnValue): string {
  return value === "fl" ? "fl" : String(value);
}

/** Round-trip helpers for controls whose values must be strings (SegmentedControl). */
export function turnValueToKey(value: TurnValue): string {
  return value === "fl" ? "fl" : String(value);
}

export function keyToTurnValue(key: string): TurnValue {
  return key === "fl" ? "fl" : Number(key);
}
