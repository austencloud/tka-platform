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

/**
 * The center-family (L5 centric) orientations by absolute compass angle,
 * 45deg steps CW from east. SVG/engine convention: 0=east, 90=south,
 * 180=west, 270=north — the same values PropRotAngleManager's
 * CENTRIC_ANGLE_MAP and rotation-maps.ts render with.
 *
 * At GridLocation.CENTER the radial reference direction is degenerate, so a
 * radial label (in/clock/...) cannot encode where the staff physically points.
 * The center-family vocabulary is absolute and survives the roundtrip — use
 * these for any state pinned at the grid center (e.g. a halved dash midpoint).
 */
export const CENTER_CYCLE: Orientation[] = [
  "centerE", "centerSE", "centerS", "centerSW",
  "centerW", "centerNW", "centerN", "centerNE",
];

/** Absolute staff angle (radians) -> center-family orientation, or null when
 *  the angle is off the 45deg lattice. */
export function staffAngleToCenterOrientation(
  staffAngle: number,
  epsilonSteps = 1e-6
): Orientation | null {
  const kFloat = normalizePositive(staffAngle) / QUARTER;
  const kRounded = Math.round(kFloat);
  if (Math.abs(kFloat - kRounded) > epsilonSteps) return null;
  return CENTER_CYCLE[((kRounded % 8) + 8) % 8]!;
}

/** Center-family orientation -> absolute staff angle in DEGREES (0=east, CW),
 *  or null for non-center-family input. */
export function centerOrientationToDegrees(ori: Orientation): number | null {
  const k = CENTER_CYCLE.indexOf(ori);
  return k === -1 ? null : k * 45;
}
