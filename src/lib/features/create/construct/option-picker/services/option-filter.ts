/**
 * Filter Service Implementation
 *
 * Handles filtering of pictograph options by type, end position, and reversals.
 * Extracted from OptionPickerService for better separation of concerns.
 */

import type { Letter } from "$lib/shared/foundation/domain/models/letter";
import { getLetterType } from "$lib/shared/foundation/domain/models/letter";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
import { GridPositionGroup } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type {
  EndPositionFilter,
  ReversalFilter,
  TypeFilter,
} from "../domain/option-picker-types";
import type { PositionAnalyzer } from "./position-analyzer";
import { getReversalCount } from "./reversal-checker";
import { LetterType } from "../../../../../shared/foundation/domain/models/letter-type";

export class OptionFilter {
  constructor(
    private positionAnalyzer: PositionAnalyzer
  ) {}

  /**
   * Apply type filtering to options
   */
  applyTypeFiltering(
    options: PictographData[],
    typeFilter: TypeFilter
  ): PictographData[] {
    return options.filter((option) => {
      const letterType = this.getLetterType(option.letter);

      switch (letterType) {
        case LetterType.TYPE1:
          return typeFilter.type1;
        case LetterType.TYPE2:
          return typeFilter.type2;
        case LetterType.TYPE3:
          return typeFilter.type3;
        case LetterType.TYPE4:
          return typeFilter.type4;
        case LetterType.TYPE5:
          return typeFilter.type5;
        case LetterType.TYPE6:
          return typeFilter.type6;
        default:
          return true; // Include unknown types by default
      }
    });
  }

  /**
   * Apply end position filtering to options
   */
  applyEndPositionFiltering(
    options: PictographData[],
    endPositionFilter: EndPositionFilter
  ): PictographData[] {
    return options.filter((option) => {
      const endPositionGroup = this.positionAnalyzer.getEndPositionGroup(
        option.endPosition
      );

      switch (endPositionGroup) {
        case GridPositionGroup.ALPHA:
          return endPositionFilter.alpha;
        case GridPositionGroup.BETA:
          return endPositionFilter.beta;
        case GridPositionGroup.GAMMA:
          return endPositionFilter.gamma;
        default:
          return true; // Include unknown positions by default
      }
    });
  }

  /**
   * Apply reversal filtering to options
   */
  applyReversalFiltering(
    options: PictographData[],
    reversalFilter: ReversalFilter,
    sequence: PictographData[]
  ): PictographData[] {
    return options.filter((option) => {
      const reversalCount = getReversalCount(option, sequence);

      switch (reversalCount) {
        case 0:
          return reversalFilter.continuous;
        case 1:
          return reversalFilter["1-reversal"];
        case 2:
          return reversalFilter["2-reversals"];
        default:
          return true; // Include unknown reversal counts by default
      }
    });
  }

  /**
   * Filter pictographs by letter type
   */
  filterPictographsByType(
    pictographs: PictographData[],
    letterType: LetterType
  ): PictographData[] {
    return pictographs.filter(
      (p: PictographData) =>
        this.getLetterTypeFromString(p.letter) === letterType
    );
  }

  /**
   * Determine letter type from letter string using shared infrastructure
   */
  private getLetterType(letter: string | null | undefined): LetterType {
    if (!letter) return LetterType.TYPE1;

    try {
      // Use the existing shared getLetterType function
      const letterEnum = letter as Letter;
      const letterType = getLetterType(letterEnum);
      return letterType as LetterType; // Returns LetterType enum value (e.g., "Type1")
    } catch (error) {
      // Fallback for invalid letters
      console.warn(
        `Failed to determine letter type for "${letter}", defaulting to TYPE1:`,
        error
      );
      return LetterType.TYPE1;
    }
  }

  /**
   * Helper function to convert string letter to Letter enum and get type
   * Uses shared infrastructure instead of duplicated logic
   */
  private getLetterTypeFromString(
    letter: string | null | undefined
  ): LetterType {
    // Delegate to the main getLetterType method which now uses shared infrastructure
    return this.getLetterType(letter);
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
import { positionAnalyzer } from "./position-analyzer";

export const optionFilter = new OptionFilter(positionAnalyzer);
