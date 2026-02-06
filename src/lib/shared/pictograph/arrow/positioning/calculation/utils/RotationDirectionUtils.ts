/**
 * Utility functions for rotation direction normalization and checking.
 *
 * Centralizes rotation direction string handling to eliminate code duplication
 * and provide consistent behavior across all rotation calculations.
 */

/**
 * Check if a rotation direction string represents clockwise rotation.
 *
 * @param direction - The rotation direction string (case-insensitive)
 * @returns true if direction is "clockwise" or "cw", false otherwise
 */
export function isClockwise(direction: string): boolean {
  const normalized = direction.toLowerCase();
  return normalized === "clockwise" || normalized === "cw";
}

/**
 * Check if a rotation direction string represents counter-clockwise rotation.
 *
 * @param direction - The rotation direction string (case-insensitive)
 * @returns true if direction is "counterclockwise", "counter-clockwise", "ccw", or "counter_clockwise"
 */
export function isCounterClockwise(direction: string): boolean {
  const normalized = direction.toLowerCase();
  return (
    normalized === "counterclockwise" ||
    normalized === "counter-clockwise" ||
    normalized === "ccw" ||
    normalized === "counter_clockwise"
  );
}

/**
 * Check if a rotation direction string represents no rotation.
 *
 * @param direction - The rotation direction string (case-insensitive)
 * @returns true if direction indicates no rotation
 */
export function isNoRotation(direction: string): boolean {
  const normalized = direction.toLowerCase();
  return (
    normalized === "norotation" ||
    normalized === "none" ||
    normalized === "no_rotation"
  );
}

/**
 * Normalize rotation direction to "cw" or "ccw".
 *
 * @param direction - The rotation direction string (case-insensitive)
 * @returns "cw" for clockwise, "ccw" for counter-clockwise
 */
export function normalizeRotationDirection(direction: string): "cw" | "ccw" {
  return isClockwise(direction) ? "cw" : "ccw";
}
