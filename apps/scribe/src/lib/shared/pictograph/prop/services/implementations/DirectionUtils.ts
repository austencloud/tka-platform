/**
 * Direction Utilities
 *
 * Helper functions for direction calculations.
 */

import type { MotionData } from "../../../shared/domain/models/MotionData";
import { VectorDirection } from "../../../shared/domain/enums/pictograph-enums";

/**
 * Opposite direction lookup table
 */
const OPPOSITE_DIRECTIONS: Record<VectorDirection, VectorDirection> = {
  [VectorDirection.UP]: VectorDirection.DOWN,
  [VectorDirection.DOWN]: VectorDirection.UP,
  [VectorDirection.LEFT]: VectorDirection.RIGHT,
  [VectorDirection.RIGHT]: VectorDirection.LEFT,
  [VectorDirection.UPRIGHT]: VectorDirection.DOWNLEFT,
  [VectorDirection.DOWNLEFT]: VectorDirection.UPRIGHT,
  [VectorDirection.UPLEFT]: VectorDirection.DOWNRIGHT,
  [VectorDirection.DOWNRIGHT]: VectorDirection.UPLEFT,
};

/**
 * Get the opposite direction.
 *
 * Used for letter-specific rules where one prop gets the opposite
 * direction of another (G/H letters, Y/Z letters).
 */
export function getOppositeDirection(
  direction: VectorDirection
): VectorDirection {
  return OPPOSITE_DIRECTIONS[direction];
}

/**
 * Get end location from motion data, handling legacy property names.
 */
export function getEndLocation(motionData: MotionData): string {
  return motionData.endLocation ?? "";
}
