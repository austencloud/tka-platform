import type { Orientation } from "../types.js";

const PI = Math.PI;
const TWO_PI = 2 * PI;
const QUARTER = PI / 4;

/** The 8-point radial cycle, CW, each step = 45deg. Index 0 = "in". */
export const RADIAL_CYCLE: Orientation[] = [
  "in", "clockIn", "clock", "clockOut",
  "out", "counterOut", "counter", "counterIn",
];

function normalizePositive(angle: number): number {
  const n = angle % TWO_PI;
  return n < 0 ? n + TWO_PI : n;
}

/**
 * The absolute staff angle for a radial orientation, given the hand's
 * center-path angle. Convention (matches the animation engine):
 *   out   = centerPathAngle
 *   in    = centerPathAngle + PI
 *   clock = centerPathAngle + PI/2
 * and each +1 step in RADIAL_CYCLE is -PI/4 from the previous, so
 *   staffAngle = centerPathAngle + PI - k*(PI/4).
 */
export function orientationToStaffAngle(
  ori: Orientation,
  centerPathAngle: number
): number {
  const k = RADIAL_CYCLE.indexOf(ori);
  if (k === -1) return normalizePositive(centerPathAngle); // non-radial: caller guards
  return normalizePositive(centerPathAngle + PI - k * QUARTER);
}

/**
 * Inverse: the radial orientation at a given absolute staff angle, or null when
 * the angle is off the 45deg lattice (no legal orientation — e.g. a 22.5deg
 * halfway point). epsilon guards floating-point noise from the engine.
 */
export function staffAngleToOrientation(
  staffAngle: number,
  centerPathAngle: number,
  epsilonSteps = 1e-6
): Orientation | null {
  const offset = normalizePositive(staffAngle - centerPathAngle);
  const kFloat = (PI - offset) / QUARTER;
  const kRounded = Math.round(kFloat);
  if (Math.abs(kFloat - kRounded) > epsilonSteps) return null;
  const idx = ((kRounded % 8) + 8) % 8;
  return RADIAL_CYCLE[idx]!;
}
