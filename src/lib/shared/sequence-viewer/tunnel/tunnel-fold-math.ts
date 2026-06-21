import type { EffectType } from "$lib/shared/animation-engine/domain/types/tip-effect-types";

/** Rotational symmetry of the tunnel. The TKA grid is 8 points (45° steps), so
 *  rotateSequence only lands on 45° multiples — 2/4/8 are the representable folds
 *  (120°/60° i.e. 3/6-fold are not). */
export type Fold = 2 | 4 | 8;

export interface TunnelConfig {
  fold: Fold;
  mirror: boolean;
  effect: EffectType;
}

/** rotateSequence amounts (1 unit = 45°) for each fold, excluding the base (0°). */
export function rotAmountsFor(fold: Fold): number[] {
  if (fold === 8) return [1, 2, 3, 4, 5, 6, 7];
  if (fold === 4) return [2, 4, 6];
  return [4];
}

/** Convert AnimationPlayer's 1-indexed fractional currentStep (where <1 is the
 *  start position) to a 0-indexed step index + fractional progress within it. */
export function stepToIndexProgress(
  currentStep: number,
  length: number,
): { idx: number; progress: number } {
  if (length <= 0) return { idx: 0, progress: 0 };
  const beat = Math.max(0, currentStep - 1); // 0-indexed
  const idx = Math.min(length - 1, Math.max(0, Math.floor(beat)));
  const progress = Math.max(0, Math.min(0.9999, beat - Math.floor(beat)));
  return { idx, progress };
}
