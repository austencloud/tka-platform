/**
 * Beat Generation Orchestrator Implementation
 *
 * Orchestrates the core beat-by-beat generation loop.
 * Extracted from SequenceGenerationService for single responsibility.
 */

import type { ILetterQueryHandler } from "$lib/shared/foundation/services/contracts/data/data-contracts";
import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";
import { PropContinuity } from "../../domain/models/generate-models";
import type { IStepConverter } from "../contracts/IStepConverter";
import type { IOrientationCalculator } from "$lib/shared/pictograph/prop/services/contracts/IOrientationCalculator";
import type { IPictographFilter } from "../contracts/IPictographFilter";
import type { ITurnManager } from "../contracts/ITurnManager";

import type {
  StepGenerationOptions,
  IStepGenerationOrchestrator,
} from "../contracts/IStepGenerationOrchestrator";
import type { IArrowPositioningOrchestrator } from "../../../../../../shared/pictograph/arrow/positioning/services/contracts/IArrowPositioningOrchestrator";

export class StepGenerationOrchestrator implements IStepGenerationOrchestrator {
  constructor(
    private letterQueryHandler: ILetterQueryHandler,
    private PictographFilter: IPictographFilter,
    private StepConverter: IStepConverter,
    private TurnManager: ITurnManager,
    private OrientationCalculator: IOrientationCalculator,
    private arrowPositioningOrchestrator: IArrowPositioningOrchestrator
  ) {}

  /**
   * Generate multiple steps for a sequence
   */
  async generateBeats(
    sequence: (StepData | StartPositionData)[],
    count: number,
    options: StepGenerationOptions
  ): Promise<StepData[]> {
    const generatedSteps: StepData[] = [];

    for (let i = 0; i < count; i++) {
      const nextStep = await this.generateNextBeat(
        sequence,
        options,
        options.turnAllocation.blue[i]!,
        options.turnAllocation.red[i]!
      );

      sequence.push(nextStep);
      generatedSteps.push(nextStep);
    }

    return generatedSteps;
  }

  /**
   * Generate next beat - orchestrates filtering and conversion
   */
  async generateNextBeat(
    sequence: (StepData | StartPositionData)[],
    options: StepGenerationOptions,
    turnBlue: number | "fl",
    turnRed: number | "fl"
  ): Promise<StepData> {
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
    const lastStep = sequence.length > 0 ? sequence[sequence.length - 1] : null;

    filteredOptions = this.PictographFilter.filterByContinuity(
      filteredOptions,
      lastStep ?? null
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
    let nextStep = this.StepConverter.convertToStep(
      selectedOption,
      sequence.length,
      options.gridMode
    );

    // Set turns if level 2 or 3
    if (options.level === 2 || options.level === 3) {
      this.TurnManager.setTurns(nextStep, turnBlue, turnRed);
    }

    // Update orientations
    if (sequence.length > 0) {
      nextStep = this.OrientationCalculator.updateStartOrientations(
        nextStep,
        sequence[sequence.length - 1]!
      );
    }

    this.TurnManager.updateDashStaticRotationDirections(
      nextStep,
      options.propContinuity,
      options.blueRotationDirection,
      options.redRotationDirection
    );

    nextStep = this.OrientationCalculator.updateEndOrientations(nextStep);

    // 🎯 CRITICAL FIX: Calculate arrow placements BEFORE returning the beat
    // This ensures arrows have correct positions instead of default (0, 0)
    const updatedPictographData =
      await this.arrowPositioningOrchestrator.calculateAllArrowPoints(nextStep);
    nextStep = { ...nextStep, ...updatedPictographData };

    return nextStep;
  }
}
