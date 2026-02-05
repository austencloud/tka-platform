/**
 * Rotated End Position Selector Interface
 *
 * Determines the required end position for rotated LOOPs based on slice size.
 */

import type { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { SliceSize } from "../../domain/models/circular-models";

export interface IRotatedEndPositionSelector {
  /**
   * Determine the required end position for a rotated LOOP
   *
   * @param sliceSize - Whether the rotation is halved (180°) or quartered (90°)
   * @param startPosition - The starting position of the sequence
   * @returns The required end position to complete the rotation
   */
  determineRotatedEndPosition(
    sliceSize: SliceSize,
    startPosition: GridPosition
  ): GridPosition;

  /**
   * Check if a given (start, end) position pair is valid for the slice size
   *
   * @param sliceSize - The slice size to validate against
   * @param startPosition - The start position
   * @param endPosition - The end position
   * @returns Whether the position pair is valid for the given slice size
   */
  isValidRotatedPair(
    sliceSize: SliceSize,
    startPosition: GridPosition,
    endPosition: GridPosition
  ): boolean;
}
