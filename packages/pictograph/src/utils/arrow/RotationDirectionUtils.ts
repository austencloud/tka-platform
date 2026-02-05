/**
 * Utility functions for rotation direction normalization and checking.
 */

export function isClockwise(direction: string): boolean {
  const normalized = direction.toLowerCase();
  return normalized === "clockwise" || normalized === "cw";
}

export function isCounterClockwise(direction: string): boolean {
  const normalized = direction.toLowerCase();
  return (
    normalized === "counterclockwise" ||
    normalized === "counter-clockwise" ||
    normalized === "ccw" ||
    normalized === "counter_clockwise"
  );
}

export function isNoRotation(direction: string): boolean {
  const normalized = direction.toLowerCase();
  return (
    normalized === "norotation" ||
    normalized === "none" ||
    normalized === "no_rotation"
  );
}

export function normalizeRotationDirection(direction: string): "cw" | "ccw" {
  return isClockwise(direction) ? "cw" : "ccw";
}
