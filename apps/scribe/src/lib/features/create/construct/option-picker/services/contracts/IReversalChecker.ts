/**
 * Motion Analysis Service Contract
 *
 * Handles analysis of motion data for reversal counting and pattern detection.
 * Extracted from OptionPickerService for better separation of concerns.
 */

import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";

export interface IReversalChecker {
  /**
   * Calculate the number of reversals by comparing rotation directions with previous pictographs
   *
   * @param option - The pictograph being added to the sequence
   * @param sequence - The existing sequence to compare against (optional, defaults to empty array)
   * @returns Number of reversals (0-2)
   */
  getReversalCount(option: PictographData, sequence?: PictographData[]): number;

  /**
   * Check if option has reversals (simple check)
   */
  hasReversals(option: PictographData): boolean;
}
