/**
 * Rotated End Position Selector
 *
 * Determines the required end position for rotated LOOPs based on:
 * - The start position
 * - The period (halved or quartered)
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
import { Period } from "../loop-types.js";

export class RotatedEndPositionSelector {
  /**
   * Determine the required end position for a rotated LOOP.
   * @param period - Whether the rotation is halved (180 degrees) or quartered (90 degrees)
   * @param startPosition - The starting position of the sequence
   * @returns The required end position to complete the rotation
   */
  determineRotatedEndPosition(period: Period, startPosition: string): string {
    if (period === Period.QUARTERED) {
      const cwEndPosition = QUARTER_POSITION_MAP_CW[startPosition];
      const ccwEndPosition = QUARTER_POSITION_MAP_CCW[startPosition];

      if (!cwEndPosition || !ccwEndPosition) {
        throw new Error(`No quartered rotation mapping for position: ${startPosition}`);
      }

      // Randomly select CW or CCW
      return Math.random() < 0.5 ? cwEndPosition : ccwEndPosition;
    }

    // Period.HALVED — use opposite position (180 degree rotation)
    const halvedEnd = HALF_POSITION_MAP[startPosition];
    if (!halvedEnd) {
      throw new Error(`No halved rotation mapping for position: ${startPosition}`);
    }
    return halvedEnd;
  }

  isValidRotatedPair(period: Period, startPosition: string, endPosition: string): boolean {
    if (period === Period.HALVED) {
      return HALF_POSITION_MAP[startPosition] === endPosition;
    }
    // Period.QUARTERED
    const cwEndPosition = QUARTER_POSITION_MAP_CW[startPosition];
    const ccwEndPosition = QUARTER_POSITION_MAP_CCW[startPosition];
    return endPosition === cwEndPosition || endPosition === ccwEndPosition;
  }
}

export const rotatedEndPositionSelector = new RotatedEndPositionSelector();
