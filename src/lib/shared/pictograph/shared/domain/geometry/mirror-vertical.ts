/**
 * Reflection across the vertical axis, and what it does to a motion.
 *
 * This is one geometric fact that had been written down in six places -
 * loop-labeler's transformation maps, its reflection comparer, the
 * prop-tracking scorecard, the dash location maps, and the sequence engine's
 * position maps each carried their own copy of "e goes to w, ne goes to nw".
 * A seventh copy is not a feature. New callers import from here.
 *
 * TKA keeps two transformations separate, and they compose rather than imply
 * each other:
 *
 * - Mirrored reflects grid positions across the vertical axis. It says nothing
 *   about which hand is doing the work.
 * - Swapped exchanges the roles of the left and right hands. What the left
 *   hand did, the right hand now does.
 *
 * Transposing a movement to the other side of the body - the thing a performer
 * means by "now do it on the left" - is both at once. Callers that want that
 * compose it; this module owns only the reflection half, because the hand swap
 * is not a property of the geometry.
 */

/** Grid locations under reflection across the vertical axis. */
export const MIRROR_VERTICAL: Readonly<Record<string, string>> = Object.freeze({
  n: "n",
  s: "s",
  e: "w",
  w: "e",
  ne: "nw",
  nw: "ne",
  se: "sw",
  sw: "se",
});

/** The reflected location, or the location itself when it is not on the grid. */
export function mirrorLocation(location: string): string {
  return MIRROR_VERTICAL[location] ?? location;
}

/**
 * Reflection reverses the sense of rotation. A rotation that is neither
 * clockwise nor counter-clockwise - a static hand, a dash - has no sense to
 * reverse and passes through.
 */
export function mirrorRotationDirection(direction: string): string {
  if (direction === "cw") return "ccw";
  if (direction === "ccw") return "cw";
  return direction;
}

/**
 * Radial orientations (in, out) point at or away from the centre, so the
 * reflection leaves them alone. The rotational pair swaps, for the same reason
 * rotation direction does.
 */
export function mirrorOrientation(orientation: string): string {
  if (orientation === "clock") return "counter";
  if (orientation === "counter") return "clock";
  return orientation;
}
