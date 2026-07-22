/**
 * Pure scoring math for the Play arcade. No runes, no IO — unit-testable.
 *
 * Points: (BASE + speed bonus) × streak multiplier, rounded. Wrong = 0.
 * Grade: accuracy bands, same letter language as Train's ResultsScreen.
 */
import type { Grade } from "./arcade-types";

export const BASE_POINTS = 100;

/** Answer-time bands → bonus points. Bands chosen so a snappy player ~1.5x's base. */
export function speedBonus(answerTimeMs: number): number {
  if (answerTimeMs < 1500) return 50;
  if (answerTimeMs < 3500) return 25;
  if (answerTimeMs < 6000) return 10;
  return 0;
}

/** Streak multiplier steps at 3/6/10, capped ×3 to keep scores readable. */
export function streakMultiplier(streakBefore: number): number {
  if (streakBefore >= 10) return 3;
  if (streakBefore >= 6) return 2;
  if (streakBefore >= 3) return 1.5;
  return 1;
}

export function scoreAnswer(input: {
  isCorrect: boolean;
  answerTimeMs: number;
  streakBefore: number;
  rewardsSpeed?: boolean;
}): number {
  if (!input.isCorrect) return 0;
  const timeBonus =
    input.rewardsSpeed === false ? 0 : speedBonus(input.answerTimeMs);
  return Math.round(
    (BASE_POINTS + timeBonus) * streakMultiplier(input.streakBefore)
  );
}

/** accuracy is 0..1 */
export function computeGrade(accuracy: number): Grade {
  if (accuracy >= 0.95) return "S";
  if (accuracy >= 0.8) return "A";
  if (accuracy >= 0.6) return "B";
  if (accuracy >= 0.5) return "C";
  return "D";
}
