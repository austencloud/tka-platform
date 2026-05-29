/**
 * Start Position Selector Implementation
 *
 * Selects start positions for sequence generation.
 * Can select a specific position or random from available positions.
 * Extracted from SequenceGenerationService for single responsibility.
 *
 * MIGRATION NOTE: Now returns StartPositionData instead of StepData with stepNumber===0
 */
import { calculateAllArrowPoints } from "$lib/shared/pictograph/arrow/orchestration/services/arrow-positioning-orchestrator";
import type {
  GridMode,
  GridPosition,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { ILetterQueryHandler } from "$lib/shared/foundation/services/data/data-contracts";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/StartPositionData";
import type { stepConverter as StepConverterType } from "$lib/features/create/generate/shared/services/step-converter";
import type { pictographFilter as PictographFilterType } from "./pictograph-filter";

// Local aliases so the constructor param annotations are readable
type StepConverter = typeof StepConverterType;
type PictographFilter = typeof PictographFilterType;
export class StartPositionSelector {
  constructor(
    private letterQueryHandler: ILetterQueryHandler,
    private PictographFilter: PictographFilter,
    private StepConverter: StepConverter
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
      await calculateAllArrowPoints(startPosition);
    startPosition = { ...startPosition, ...updatedPictographData };

    return startPosition;
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
import { letterQueryHandler } from "$lib/shared/pictograph/tka-glyph/services/letter-query-handler";
import { pictographFilter } from "./pictograph-filter";
import { stepConverter } from "./step-converter";

export const startPositionSelector = new StartPositionSelector(
  letterQueryHandler,
  pictographFilter,
  stepConverter
);
