/**
 * LOOP End Position Resolver Interface
 *
 * Resolves valid end positions for a sequence seed given a start position and LOOP type.
 * Used by RandomSequenceGenerator to constrain the last letter's variation selection
 * so the sequence ends at a position compatible with the chosen LOOP extension.
 *
 * The resolver follows the same precedence as LOOPEndPositionSelector:
 * ROTATED > MIRRORED > INVERTED > SWAPPED
 *
 * For composite LOOPs, only the innermost (highest-precedence) transformation
 * constrains the seed's end position. Outer transformations operate on the
 * already-extended result.
 */

import type { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { LOOPType, Period } from "$lib/features/create/generate/circular/domain/models/circular-models";

export interface ILOOPEndPositionResolver {
  /**
   * Get all valid end positions for a sequence seed given a start position and LOOP type.
   *
   * Returns an empty array for LOOP types with no position constraint (e.g., REWOUND),
   * signaling the caller to skip end position filtering entirely.
   *
   * For quartered rotations, returns both CW and CCW targets to maximize flexibility.
   *
   * @param startPosition - The sequence's start position
   * @param loopType - The LOOP type to constrain for
   * @param period - Halved (180) or quartered (90) rotation. Defaults to HALVED.
   * @returns Array of valid end positions, or empty array if unconstrained
   */
  getValidEndPositions(
    startPosition: GridPosition,
    loopType: LOOPType,
    period?: Period
  ): GridPosition[];

  /**
   * Check whether a specific end position is valid for the given LOOP type.
   *
   * @param startPosition - The sequence's start position
   * @param endPosition - The candidate end position to validate
   * @param loopType - The LOOP type to check against
   * @param period - Halved or quartered rotation. Defaults to HALVED.
   * @returns True if the end position is compatible with the LOOP type
   */
  isValidEndPosition(
    startPosition: GridPosition,
    endPosition: GridPosition,
    loopType: LOOPType,
    period?: Period
  ): boolean;
}
