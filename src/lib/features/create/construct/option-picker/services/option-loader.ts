/**
 * Option Loader Service Implementation
 *
 * Handles loading of available pictograph options based on sequence context.
 * Extracted from OptionPickerService for better separation of concerns.
 */

import type { IMotionQueryHandler } from "$lib/shared/foundation/services/data/data-contracts";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { PositionAnalyzer } from "./position-analyzer";
import { getGridPositionFromLocations } from "$lib/shared/pictograph/grid/services/grid-position-deriver";

export class OptionLoader {
  constructor(
    private motionQueryHandler: IMotionQueryHandler,
    private positionAnalyzer: PositionAnalyzer
  ) {}

  /**
   * Load available options based on current sequence and grid mode
   * PRESERVED: Core working logic from OptionPickerDataService
   */
  async loadOptions(
    sequence: PictographData[],
    gridMode: GridMode
  ): Promise<PictographData[]> {
    if (sequence.length === 0) {
      return [];
    }

    const lastStep = sequence[sequence.length - 1]!;
    const endPosition = this.positionAnalyzer.getEndPosition(lastStep);

    if (!endPosition || typeof endPosition !== "string") {
      return [];
    }

    // Errors propagate to the caller — option-picker-state catches them and
    // routes to its error state so the user sees a retryable error instead of
    // a silently empty picker.
    const allOptions =
      await this.motionQueryHandler.getNextOptionsForSequence(
        sequence,
        gridMode
      );

    // Filter options based on sequence context
    // The next beat's start position should match the current beat's end position
    const filteredOptions = allOptions.filter((option) => {
      if (!option.motions.blue || !option.motions.red) {
        return false;
      }

      // Calculate the start position of this option
      const optionStartPosition =
        getGridPositionFromLocations(
          option.motions.blue.startLocation,
          option.motions.red.startLocation
        );

      const optionStartPositionStr = optionStartPosition
        .toString()
        .toLowerCase();
      const targetEndPosition = endPosition.toLowerCase();

      return optionStartPositionStr === targetEndPosition;
    });

    return filteredOptions;
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
import { motionQueryHandler } from "$lib/shared/pictograph/shared/services/motion-query-handler";
import { positionAnalyzer } from "./position-analyzer";

export const optionLoader = new OptionLoader(
  motionQueryHandler,
  positionAnalyzer
);
