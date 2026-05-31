/**
 * Option Sorter Implementation
 *
 * Handles sorting of pictograph options by different methods.
 * Extracted from OptionPickerService for better separation of concerns.
 */

import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
import type { SortMethod } from "../domain/option-picker-types";
import type { PositionAnalyzer } from "./position-analyzer";
import { hasReversals } from "./reversal-checker";

export class OptionSorter {
  constructor(
    private positionAnalyzer: PositionAnalyzer
  ) {}

  /**
   * Apply sorting to options based on the specified sort method
   * PRESERVED: Core sorting logic from OptionPickerService
   */
  applySorting(
    options: PictographData[],
    sortMethod: SortMethod
  ): PictographData[] {
    const sorted = [...options];

    switch (sortMethod) {
      case "type":
        return sorted.sort((a, b) => {
          const aLetter = a.letter ?? "";
          const bLetter = b.letter ?? "";
          return aLetter.localeCompare(bLetter);
        });

      case "endPosition":
        return sorted.sort((a, b) => {
          const aPos = this.positionAnalyzer.getEndPosition(a) ?? "";
          const bPos = this.positionAnalyzer.getEndPosition(b) ?? "";
          return aPos.localeCompare(bPos);
        });

      case "reversals":
        return sorted.sort((a, b) => {
          const aHasRev = hasReversals(a);
          const bHasRev = hasReversals(b);
          if (aHasRev === bHasRev) {
            // If both have or don't have reversals, sort by letter
            const aLetter = a.letter ?? "";
            const bLetter = b.letter ?? "";
            return aLetter.localeCompare(bLetter);
          }
          return aHasRev ? -1 : 1; // Reversals first
        });

      default:
        return sorted;
    }
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
import { positionAnalyzer } from "./position-analyzer";

export const optionSorter = new OptionSorter(positionAnalyzer);
