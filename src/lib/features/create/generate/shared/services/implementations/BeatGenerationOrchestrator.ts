/**
 * Beat Generation Orchestrator Implementation
 *
 * Orchestrates the core beat-by-beat generation loop.
 * Extracted from SequenceGenerationService for single responsibility.
 */

import type { ILetterQueryHandler } from "$lib/shared/foundation/services/contracts/data/data-contracts";
import type { BeatData } from "$lib/features/create/shared/domain/models/BeatData";
import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";
import { PropContinuity } from "../../domain/models/generate-models";
import type { IBeatConverter } from "../contracts/IBeatConverter";
import type { IOrientationCalculator } from "$lib/shared/pictograph/prop/services/contracts/IOrientationCalculator";
import type { IPictographFilter } from "../contracts/IPictographFilter";
import type { ITurnManager } from "../contracts/ITurnManager";

import type {
  BeatGenerationOptions,
  IBeatGenerationOrchestrator,
} from "../contracts/IBeatGenerationOrchestrator";
import type { IArrowPositioningOrchestrator } from "../../../../../../shared/pictograph/arrow/positioning/services/contracts/IArrowPositioningOrchestrator";

export class BeatGenerationOrchestrator implements IBeatGenerationOrchestrator {
  constructor(
    private letterQueryHandler: ILetterQueryHandler,
    private PictographFilter: IPictographFilter,
    private BeatConverter: IBeatConverter,
    private TurnManager: ITurnManager,
    private OrientationCalculator: IOrientationCalculator,
    private arrowPositioningOrchestrator: IArrowPositioningOrchestrator
  ) {}

  /**
   * Generate multiple beats for a sequence
   */
  async generateBeats(
    sequence: (BeatData | StartPositionData)[],
    count: number,
    options: BeatGenerationOptions
  ): Promise<BeatData[]> {
    const generatedBeats: BeatData[] = [];

    for (let i = 0; i < count; i++) {
      const nextBeat = await this.generateNextBeat(
        sequence,
        options,
        options.turnAllocation.blue[i]!,
        options.turnAllocation.red[i]!
      );

      sequence.push(nextBeat);
      generatedBeats.push(nextBeat);
    }

    return generatedBeats;
  }

  /**
   * Generate next beat - orchestrates filtering and conversion
   */
  async generateNextBeat(
    sequence: (BeatData | StartPositionData)[],
    options: BeatGenerationOptions,
    turnBlue: number | "fl",
    turnRed: number | "fl"
  ): Promise<BeatData> {
    // Get all options
    let allOptions = await this.letterQueryHandler.getAllPictographVariations(
      options.gridMode
    );

    // Filter by prop type to ensure consistency with selected prop
    allOptions = this.PictographFilter.filterByPropType(
      allOptions,
      options.propType
    );

    // Apply filters
    let filteredOptions = allOptions;
    const lastBeat = sequence.length > 0 ? sequence[sequence.length - 1] : null;

    filteredOptions = this.PictographFilter.filterByContinuity(
      filteredOptions,
      lastBeat ?? null
    );

    // Filter out static Type 6 pictographs based on level
    // Level 1: No Type 6 allowed (no turns), Level 2+: Only Type 6 with turns
    filteredOptions = this.PictographFilter.filterStaticType6(
      filteredOptions,
      options.level
    );

    if (options.propContinuity === PropContinuity.CONTINUOUS) {
      filteredOptions = this.PictographFilter.filterByRotation(
        filteredOptions,
        options.blueRotationDirection,
        options.redRotationDirection
      );
    }

    // Apply end position constraint if specified (for last beat in freeform mode)
    if (options.requiredEndPosition) {
      filteredOptions = this.PictographFilter.filterByEndPosition(
        filteredOptions,
        options.requiredEndPosition
      );
    }

    if (filteredOptions.length === 0) {
      throw new Error("No valid options available after filtering");
    }

    // Random selection
    const selectedOption = this.PictographFilter.selectRandom(filteredOptions);

    // Convert to beat
    let nextBeat = this.BeatConverter.convertToBeat(
      selectedOption,
      sequence.length,
      options.gridMode
    );

    // Set turns if level 2 or 3
    if (options.level === 2 || options.level === 3) {
      this.TurnManager.setTurns(nextBeat, turnBlue, turnRed);
    }

    // Update orientations
    if (sequence.length > 0) {
      nextBeat = this.OrientationCalculator.updateStartOrientations(
        nextBeat,
        sequence[sequence.length - 1]!
      );
    }

    this.TurnManager.updateDashStaticRotationDirections(
      nextBeat,
      options.propContinuity,
      options.blueRotationDirection,
      options.redRotationDirection
    );

    nextBeat = this.OrientationCalculator.updateEndOrientations(nextBeat);

    // 🎯 CRITICAL FIX: Calculate arrow placements BEFORE returning the beat
    // This ensures arrows have correct positions instead of default (0, 0)
    const updatedPictographData =
      await this.arrowPositioningOrchestrator.calculateAllArrowPoints(nextBeat);
    nextBeat = { ...nextBeat, ...updatedPictographData };

    return nextBeat;
  }
}
