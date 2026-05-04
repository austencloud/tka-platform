/**
 * Rotated End Position Selector
 *
 * Determines the required end position for rotated LOOPs based on:
 * - The start position
 * - The slice size (halved or quartered)
 *
 * For halved LOOPs: Returns the opposite position (180° rotation)
 * For quartered LOOPs: Randomly chooses between clockwise or counter-clockwise 90° rotation
 */

import type { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  HALF_POSITION_MAP,
  QUARTER_POSITION_MAP_CCW,
  QUARTER_POSITION_MAP_CW,
} from "../domain/constants/circular-position-maps";
import { Period } from "../domain/models/circular-models";

/**
 * Determine the required end position for a rotated LOOP.
 *
 * @param period - Whether the rotation is halved (180°) or quartered (90°)
 * @param startPosition - The starting position of the sequence
 * @returns The required end position to complete the rotation
 */
export function determineRotatedEndPosition(
  period: Period,
  startPosition: GridPosition
): GridPosition {
  if (period === Period.QUARTERED) {
    // For quartered LOOPs, randomly choose between clockwise and counter-clockwise
    // Non-null assertion: LOOP operations only use alpha/beta/gamma positions
    const cwEndPosition = QUARTER_POSITION_MAP_CW[startPosition]!;
    const ccwEndPosition = QUARTER_POSITION_MAP_CCW[startPosition]!;

    // Randomly select one
    return Math.random() < 0.5 ? cwEndPosition : ccwEndPosition;
  }
  // Period.HALVED
  // For halved LOOPs, use the opposite position (180° rotation)
  // Non-null assertion: LOOP operations only use alpha/beta/gamma positions
  return HALF_POSITION_MAP[startPosition]!;
}

/**
 * Check if a given (start, end) position pair is valid for the slice size.
 *
 * @param period - The slice size to validate against
 * @param startPosition - The start position
 * @param endPosition - The end position
 * @returns Whether the position pair is valid for the given slice size
 */
export function isValidRotatedPair(
  period: Period,
  startPosition: GridPosition,
  endPosition: GridPosition
): boolean {
  if (period === Period.HALVED) {
    return HALF_POSITION_MAP[startPosition] === endPosition;
  }
  // Period.QUARTERED
  const cwEndPosition = QUARTER_POSITION_MAP_CW[startPosition];
  const ccwEndPosition = QUARTER_POSITION_MAP_CCW[startPosition];
  return endPosition === cwEndPosition || endPosition === ccwEndPosition;
}
