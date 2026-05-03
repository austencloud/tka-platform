/**
 * Start Position Selector Implementation
 *
 * Selects start positions for sequence generation.
 * Can select a specific position or random from available positions.
 * Extracted from SequenceGenerationService for single responsibility.
 *
 * MIGRATION NOTE: Now returns StartPositionData instead of StepData with stepNumber===0
 */
import type { IArrowPositioningOrchestrator } from "$lib/shared/pictograph/arrow/positioning/services/contracts/IArrowPositioningOrchestrator";
import type {
  GridMode,
  GridPosition,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { ILetterQueryHandler } from "$lib/shared/foundation/services/contracts/data/data-contracts";
import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";
import type { IStepConverter } from "../contracts/IStepConverter";
import type { PictographFilter } from "./PictographFilter";
export class StartPositionSelector {
  constructor(
    private letterQueryHandler: ILetterQueryHandler,
    private PictographFilter: PictographFilter,
    private StepConverter: IStepConverter,
    private arrowPositioningOrchestrator: IArrowPositioningOrchestrator
  ) {}

  /**
   * Select a start position
   * @param gridMode - Grid mode (diamond/box)
   * @param specificPosition - Optional specific position to use (random if not provided)
   * @returns StartPositionData with proper type discriminator
   */
  async selectStartPosition(
    gridMode: GridMode,
    specificPosition?: GridPosition
  ): Promise<StartPositionData> {
    const allOptions =
      await this.letterQueryHandler.getAllPictographVariations(gridMode);
    const startPositions =
      this.PictographFilter.filterStartPositions(allOptions);

    // If a specific position is requested, find it; otherwise select random
    let startPictograph;
    if (specificPosition) {
      startPictograph = startPositions.find(
        (p) => p.startPosition === specificPosition
      );
      // Fallback to random if specific position not found
      if (!startPictograph) {
        console.warn(
          `Start position ${specificPosition} not found, falling back to random`
        );
        startPictograph = this.PictographFilter.selectRandom(startPositions);
      }
    } else {
      startPictograph = this.PictographFilter.selectRandom(startPositions);
    }

    // Use the new convertToStartPosition method instead of convertToStep(pictograph, 0, gridMode)
    let startPosition = this.StepConverter.convertToStartPosition(
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

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
import { letterQueryHandler } from "$lib/shared/pictograph/tka-glyph/services/implementations/LetterQueryHandler";
import { pictographFilter } from "./PictographFilter";
import { stepConverter } from "./StepConverter";
import { arrowPositioningOrchestrator } from "$lib/shared/pictograph/arrow/orchestration/services/implementations/ArrowPositioningOrchestrator";

export const startPositionSelector = new StartPositionSelector(
  letterQueryHandler,
  pictographFilter,
  stepConverter,
  arrowPositioningOrchestrator
);
