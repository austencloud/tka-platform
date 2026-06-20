/**
 * Reversal Utility
 *
 * Shared helper for determining whether a rotation-direction change between two
 * consecutive steps represents a reversal. Used by both the continuity and
 * reversal constraints so the `no_rot`/`noRotation` normalisation lives in one
 * place.
 */

/**
 * Check if a rotation direction change represents a reversal.
 *
 * A reversal is a cw→ccw or ccw→cw transition. Static / no-rotation directions
 * (either `no_rot` or `noRotation`) can never be a reversal.
 */
export function isReversal(prev: string, current: string): boolean {
  if (
    prev === "no_rot" ||
    prev === "noRotation" ||
    current === "no_rot" ||
    current === "noRotation"
  ) {
    return false;
  }
  return (
    (prev === "cw" && current === "ccw") ||
    (prev === "ccw" && current === "cw")
  );
}
