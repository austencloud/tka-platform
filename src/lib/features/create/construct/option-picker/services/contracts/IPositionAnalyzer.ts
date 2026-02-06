/**
 * Position Analysis Service Contract
 *
 * Handles analysis of position data for end position calculations, grouping,
 * and rotation relationships. Used by option picker and sequence extension.
 */

import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type {
  GridPositionGroup,
  GridPosition,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

/**
 * Describes the rotation relationship between two positions in the same group.
 * - 'exact': Same position (0° rotation)
 * - 'quarter': 90° rotation (positions are 2 steps apart in alpha/beta, 4 in gamma)
 * - 'half': 180° rotation (positions are opposite, e.g., alpha1 ↔ alpha5)
 */
export type RotationRelation = "exact" | "quarter" | "half";

export interface IPositionAnalyzer {
  /**
   * Get the position group (Alpha, Beta, Gamma) from a GridPosition
   */
  getEndPositionGroup(
    endPosition: GridPosition | null | undefined
  ): GridPositionGroup | null;

  /**
   * Calculate end position from motion data
   */
  getEndPosition(pictographData: PictographData): string | null;

  /**
   * Extract the numeric part of a position (e.g., "alpha3" → 3)
   */
  getPositionNumber(position: GridPosition): number | null;

  /**
   * Calculate the rotation relationship between two positions in the same group.
   *
   * For alpha/beta (8 positions: 1-8):
   * - Same number = exact (0°)
   * - Difference of 2 = quarter (90°)
   * - Difference of 4 = half (180°)
   *
   * For gamma (16 positions: 1-16):
   * - Same number = exact (0°)
   * - Difference of 4 = quarter (90°)
   * - Difference of 8 = half (180°)
   *
   * @returns The rotation relation, or null if positions are in different groups
   */
  getRotationRelation(
    startPosition: GridPosition,
    endPosition: GridPosition
  ): RotationRelation | null;

  /**
   * Check if two positions are in the same group (can potentially form a loop)
   */
  areInSameGroup(position1: GridPosition, position2: GridPosition): boolean;
}
