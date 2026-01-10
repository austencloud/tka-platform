/**
 * Start Position Selector Implementation
 *
 * Selects random start positions for sequence generation.
 * Extracted from SequenceGenerationService for single responsibility.
 *
 * MIGRATION NOTE: Now returns StartPositionData instead of BeatData with beatNumber===0
 */
import type { IArrowPositioningOrchestrator } from "$lib/shared/pictograph/arrow/positioning/services/contracts/IArrowPositioningOrchestrator";
import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { ILetterQueryHandler } from "$lib/shared/foundation/services/contracts/data/data-contracts";
import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";
import type { IBeatConverter } from "../contracts/IBeatConverter";
import type { IPictographFilter } from "../contracts/IPictographFilter";
import type { IStartPositionSelector } from "../contracts/IStartPositionSelector";

export class StartPositionSelector implements IStartPositionSelector {
  constructor(
    private letterQueryHandler: ILetterQueryHandler,
    private PictographFilter: IPictographFilter,
    private BeatConverter: IBeatConverter,
    private arrowPositioningOrchestrator: IArrowPositioningOrchestrator
  ) {}

  /**
   * Select a random start position
   * Now returns proper StartPositionData with type discriminator
   */
  async selectStartPosition(gridMode: GridMode): Promise<StartPositionData> {
    const allOptions =
      await this.letterQueryHandler.getAllPictographVariations(gridMode);
    const startPositions =
      this.PictographFilter.filterStartPositions(allOptions);
    const startPictograph = this.PictographFilter.selectRandom(startPositions);

    // Use the new convertToStartPosition method instead of convertToBeat(pictograph, 0, gridMode)
    let startPosition = this.BeatConverter.convertToStartPosition(
      startPictograph,
      gridMode
    );

    // 🎯 CRITICAL FIX: Calculate arrow placements for start position
    // This ensures start position arrows have correct positions instead of default (0, 0)
    const updatedPictographData =
      await this.arrowPositioningOrchestrator.calculateAllArrowPoints(
        startPosition
      );
    startPosition = { ...startPosition, ...updatedPictographData };

    return startPosition;
  }
}
