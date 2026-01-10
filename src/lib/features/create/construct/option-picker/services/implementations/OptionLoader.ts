/**
 * Option Loader Service Implementation
 *
 * Handles loading of available pictograph options based on sequence context.
 * Extracted from OptionPickerService for better separation of concerns.
 */

import type { IMotionQueryHandler } from "$lib/shared/foundation/services/contracts/data/data-contracts";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { IPositionAnalyzer } from "../contracts/IPositionAnalyzer";
import type { IOptionLoader } from "../contracts/IOptionLoader";
import type { IGridPositionDeriver } from "$lib/shared/pictograph/grid/services/contracts/IGridPositionDeriver";

export class OptionLoader implements IOptionLoader {
  constructor(
    private positionMapper: IGridPositionDeriver,
    private motionQueryHandler: IMotionQueryHandler,
    private positionAnalyzer: IPositionAnalyzer
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

    const lastBeat = sequence[sequence.length - 1]!;
    const endPosition = this.positionAnalyzer.getEndPosition(lastBeat);

    if (!endPosition || typeof endPosition !== "string") {
      return [];
    }

    try {
      // Get all available options from motion query service
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
          this.positionMapper.getGridPositionFromLocations(
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
    } catch (error) {
      console.error("Failed to load options from sequence:", error);
      return [];
    }
  }
}
