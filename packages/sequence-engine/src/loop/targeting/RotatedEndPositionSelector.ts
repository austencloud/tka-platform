/**
 * Rotated End Position Selector
 *
 * Determines the required end position for rotated LOOPs based on:
 * - The start position
 * - The slice size (halved or quartered)
 *
 * For halved LOOPs: Returns the opposite position (180 degree rotation)
 * For quartered LOOPs: Randomly chooses between clockwise or counter-clockwise 90 degree rotation
 *
 * Ported from app's RotatedEndPositionSelector.ts.
 */

import {
  HALF_POSITION_MAP,
  QUARTER_POSITION_MAP_CW,
  QUARTER_POSITION_MAP_CCW,
} from "../position-maps/circular-position-maps.js";
import { SliceSize } from "../loop-types.js";

export class RotatedEndPositionSelector {
  /**
   * Determine the required end position for a rotated LOOP.
   *
   * @param sliceSize - Whether the rotation is halved (180 degrees) or quartered (90 degrees)
   * @param startPosition - The starting position of the sequence
   * @returns The required end position to complete the rotation
   */
  determineRotatedEndPosition(sliceSize: SliceSize, startPosition: string): string {
    if (sliceSize === SliceSize.QUARTERED) {
      const cwEndPosition = QUARTER_POSITION_MAP_CW[startPosition];
      const ccwEndPosition = QUARTER_POSITION_MAP_CCW[startPosition];

      if (!cwEndPosition || !ccwEndPosition) {
        throw new Error(`No quartered rotation mapping for position: ${startPosition}`);
      }

      // Randomly select CW or CCW
      return Math.random() < 0.5 ? cwEndPosition : ccwEndPosition;
    }

    // SliceSize.HALVED — use opposite position (180 degree rotation)
    const halvedEnd = HALF_POSITION_MAP[startPosition];
    if (!halvedEnd) {
      throw new Error(`No halved rotation mapping for position: ${startPosition}`);
    }
    return halvedEnd;
  }

  /**
   * Check if a given (start, end) position pair is valid for the slice size.
   */
  isValidRotatedPair(sliceSize: SliceSize, startPosition: string, endPosition: string): boolean {
    if (sliceSize === SliceSize.HALVED) {
      return HALF_POSITION_MAP[startPosition] === endPosition;
    }
    // SliceSize.QUARTERED
    const cwEndPosition = QUARTER_POSITION_MAP_CW[startPosition];
    const ccwEndPosition = QUARTER_POSITION_MAP_CCW[startPosition];
    return endPosition === cwEndPosition || endPosition === ccwEndPosition;
  }
}

export const rotatedEndPositionSelector = new RotatedEndPositionSelector();
