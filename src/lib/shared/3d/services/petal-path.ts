/**
 * Petal geometry for concave (anti-spin) hand paths.
 *
 * Within one step an anti-spin path dips toward the center once per petal.
 * petalsPerStep = 1 + turns (1 TKA turn = 180° extra rotation), so a 4-step
 * cycle yields 4 petals at 0 turns, 6 at continuous half turns, 8 at 1 turn.
 * Valleys (radius back at grid radius) sit at progress i/petalsPerStep; dips
 * peak at petal midpoints.
 *
 * Depth k ∈ [0,1]: k=0 reproduces the legacy chord-reflection dip radius,
 * k=1 pulls the dip all the way to the center (the practical upper limit —
 * the hand traces at the center point).
 */

/** Legacy chord-reflection radius at the midpoint of a 90° quadrant step. */
export const BASE_DIP_RADIUS = 2 * Math.cos(Math.PI / 4) - 1; // ≈ 0.4142

export function petalsPerStep(turns: number): number {
  return 1 + Math.max(0, turns);
}

/**
 * Radius multiplier (0..1 of grid radius) for a concave path at `progress`
 * within a step, for a motion with `turns`, at depth `k`.
 */
export function concaveRadiusProfile(
  progress: number,
  turns: number,
  k: number
): number {
  const m = petalsPerStep(turns);
  // 0 at valleys (progress = i/m), 1 at petal midpoints.
  const dipPhase = Math.abs(Math.sin(Math.PI * m * progress));
  const dipFloor = BASE_DIP_RADIUS * (1 - clamp01(k));
  // radius glides from 1 (valley) down to dipFloor (petal midpoint).
  return 1 - dipPhase * (1 - dipFloor);
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
