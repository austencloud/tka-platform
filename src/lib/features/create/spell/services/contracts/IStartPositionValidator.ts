/**
 * Start Position Validator Service Interface
 *
 * Validates that start positions are static pictographs (Type 6 letters only).
 * Start positions must have startPosition === endPosition (no movement).
 */

import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

export interface IStartPositionValidator {
  /**
   * Get all valid start positions for a given first letter and grid mode.
   * Only Type 6 letters (α, β, γ, ζ, η, τ, ⊕) are valid start positions.
   * Start positions must be static (startPosition === endPosition).
   *
   * @param firstLetter - The first letter of the sequence
   * @param gridMode - The grid mode (diamond, box, or skewed)
   * @returns Array of valid static pictographs that end at the required position group
   * @throws Error if no valid start positions exist for the given letter
   */
  getValidStartPositions(
    firstLetter: Letter,
    gridMode: GridMode
  ): Promise<PictographData[]>;

  /**
   * Check if a pictograph is a valid start position.
   * Valid start positions must:
   * 1. Be a Type 6 (static) letter
   * 2. Have startPosition === endPosition
   *
   * @param pictograph - The pictograph to validate
   * @returns True if this is a valid start position
   */
  isValidStartPosition(pictograph: PictographData): boolean;
}
