import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";
import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import { createStartPositionFromStepEnd } from "../../../../shared/services/implementations/sequence-transforms/sequence-transforms";
import type { ILOOPEndPositionSelector } from "../../../circular/services/contracts/ILOOPEndPositionSelector";
import type { ILOOPExecutorSelector } from "../../../circular/services/contracts/ILOOPExecutorSelector";
import type { IPartialSequenceGenerator } from "../../../circular/services/contracts/IPartialSequenceGenerator";
import type { ILOOPParameterProvider } from "../contracts/ILOOPParameterProvider";
import type { GenerationOptions } from "../../domain/models/generate-models";
import {
  GenerationMode,
  PropContinuity,
} from "../../domain/models/generate-models";
import { getRandomAllowedPosition } from "../../domain/start-position-presets";
import type { IStepGenerationOrchestrator } from "../contracts/IStepGenerationOrchestrator";
import type { StepGenerationOptions } from "../contracts/IStepGenerationOrchestrator";
import type { IGenerationOrchestrator } from "../contracts/IGenerationOrchestrator";
import type { ISequenceMetadataManager } from "../contracts/ISequenceMetadataManager";
import type { IStartPositionSelector } from "../contracts/IStartPositionSelector";
import type { ITurnAllocator } from "../contracts/ITurnAllocator";
import type { IReversalDetector } from "../../../../shared/services/contracts/IReversalDetector";
/**
 * Service orchestrating the complete sequence generation pipeline
 *
 * Extracted from generate-actions.svelte.ts to separate orchestration logic
 * from state management. This service composes multiple focused services to
 * build complete sequences for both freeform and circular modes.
 */
export class GenerationOrchestrator implements IGenerationOrchestrator {
  constructor(
    private readonly startPositionSelector: IStartPositionSelector,
    private readonly loopParams: ILOOPParameterProvider,
    private readonly turnAllocationCalculator: ITurnAllocator,
    private readonly stepGenerationOrchestrator: IStepGenerationOrchestrator,
    private readonly metadataService: ISequenceMetadataManager,
    private readonly ReversalDetector: IReversalDetector,
    private readonly partialSequenceGenerator: IPartialSequenceGenerator,
    private readonly loopEndPositionSelector: ILOOPEndPositionSelector,
    private readonly loopExecutorSelector: ILOOPExecutorSelector
  ) {}

  /**
   * Generate complete sequence - routes to appropriate mode
   */
  async generateSequence(options: GenerationOptions): Promise<SequenceData> {
    // Route to appropriate generation mode
    if (options.mode === GenerationMode.CIRCULAR) {
      return this.generateCircularSequence(options);
    }

    return this.generateFreeformSequence(options);
  }

  /**
   * Generate freeform sequence using focused service composition
   * EXACT ORIGINAL LOGIC from SequenceGenerationService.generateSequence
   */
  private async generateFreeformSequence(
    options: GenerationOptions
  ): Promise<SequenceData> {
    // Step 1: Get start position
    // Priority: legacy startPosition > random from allowed positions
    let startPosition: StartPositionData;
    if (options.startPosition) {
      // Use the legacy exact start position - convert PictographData to StartPositionData
      startPosition = this.convertPictographToStartPosition(
        options.startPosition
      );
    } else {
      // Select random position respecting blocked positions
      const blockedPositions = options.blockedStartPositions ?? [];
      const randomGridPos = getRandomAllowedPosition(
        blockedPositions,
        options.gridMode
      );

      // Use the selector to get full StartPositionData for this position
      startPosition = await this.startPositionSelector.selectStartPosition(
        options.gridMode,
        randomGridPos
      );
    }
    const sequence: (StepData | StartPositionData)[] = [startPosition];

    // Step 2: Determine rotation directions
    const rotationDirections = this.loopParams.determineRotationDirections(
      options.propContinuity
    );

    // Step 3: Calculate turn allocation
    const level = this.metadataService.mapDifficultyToLevel(options.difficulty);
    const turnIntensity = options.turnIntensity || 1;
    const turnAllocation = await this.turnAllocationCalculator.allocateTurns(
      options.length,
      level,
      turnIntensity
    );

    // Step 4: Generate steps
    const beatGenOptions: StepGenerationOptions = {
      level,
      turnAllocation,
      propContinuity: options.propContinuity || PropContinuity.CONTINUOUS,
      blueRotationDirection: rotationDirections.blueRotationDirection,
      redRotationDirection: rotationDirections.redRotationDirection,
      gridMode: options.gridMode,
      propType: options.propType,
    };

    let generatedSteps: StepData[];

    // If end position is specified, we need to handle the last beat specially
    const hasEndPositionConstraint = options.endPosition?.startPosition;

    if (hasEndPositionConstraint && options.length > 0) {
      // Generate all steps except the last one
      if (options.length > 1) {
        const allButLastBeats =
          await this.stepGenerationOrchestrator.generateBeats(
            sequence,
            options.length - 1,
            beatGenOptions
          );
        generatedSteps = allButLastBeats;
      } else {
        generatedSteps = [];
      }

      // Generate the last beat with the end position constraint
      const lastBeatOptions: StepGenerationOptions = {
        ...beatGenOptions,
        requiredEndPosition: options.endPosition!.startPosition!,
        // Create a turn allocation for just this beat
        turnAllocation: {
          blue: [turnAllocation.blue[options.length - 1]!],
          red: [turnAllocation.red[options.length - 1]!],
        },
      };

      const lastStep = await this.stepGenerationOrchestrator.generateNextBeat(
        sequence,
        lastBeatOptions,
        turnAllocation.blue[options.length - 1]!,
        turnAllocation.red[options.length - 1]!
      );

      sequence.push(lastStep);
      generatedSteps.push(lastStep);
    } else {
      // No end position constraint - generate all steps normally
      generatedSteps = await this.stepGenerationOrchestrator.generateBeats(
        sequence,
        options.length,
        beatGenOptions
      );
    }

    // Step 5: Build sequence data structure
    const word = this.metadataService.calculateWordFromBeats(generatedSteps);
    const metadata = this.metadataService.createGenerationMetadata({
      stepsGenerated: generatedSteps.length,
      propContinuity: options.propContinuity || PropContinuity.CONTINUOUS,
      blueRotationDirection: rotationDirections.blueRotationDirection,
      redRotationDirection: rotationDirections.redRotationDirection,
      turnIntensity,
      level,
    });

    // Import shared utilities dynamically to avoid circular dependencies
    const { createSequenceData } =
      await import("$lib/shared/foundation/domain/models/SequenceData");

    const sequenceData = createSequenceData({
      name: word || `Sequence ${Date.now()}`,
      word,
      steps: generatedSteps,
      startingPosition: startPosition,
      startPosition,
      gridMode: options.gridMode,
      // propType removed - prop type is viewer preference, not sequence data
      difficultyLevel: options.difficulty,
      isFavorite: false,
      isCircular: false,
      tags: ["generated", "freeform"],
      metadata,
    });

    // Step 6: Apply reversal detection
    const finalSequence = this.ReversalDetector.processReversals(sequenceData);

    return finalSequence;
  }

  /**
   * Generate circular sequence using LOOP executor
   * EXACT ORIGINAL LOGIC from SequenceGenerationService.generatePatternSequence
   */
  private async generateCircularSequence(
    options: GenerationOptions
  ): Promise<SequenceData> {
    // Import circular-specific models
    const { LOOPType, SliceSize } =
      await import("../../../circular/domain/models/circular-models");

    // Use constructor-injected services to avoid HMR issues
    // Determine which LOOP executor to use based on loopType option
    const loopType = options.loopType || LOOPType.STRICT_ROTATED;
    const loopExecutor = this.loopExecutorSelector.getExecutor(loopType);

    // Get slice size
    const sliceSize = options.sliceSize || SliceSize.HALVED;

    // Determine start position
    // Priority: legacy startPosition > random from allowed positions (respecting blocklist)
    const { GridPosition } =
      await import("$lib/shared/pictograph/grid/domain/enums/grid-enums");
    type GridPositionType = (typeof GridPosition)[keyof typeof GridPosition];

    let startPos: GridPositionType | undefined;

    if (options.startPosition?.startPosition) {
      // Use the legacy exact start position's grid position
      startPos = options.startPosition.startPosition as GridPositionType;
    } else {
      // Select random position respecting blocked positions
      const blockedPositions = options.blockedStartPositions ?? [];
      startPos = getRandomAllowedPosition(blockedPositions, options.gridMode);
    }

    if (!startPos) {
      throw new Error("Failed to determine a starting grid position");
    }
    // Use LOOP-specific end position selector (different end positions for rotated/mirrored/swapped/inverted)
    const requiredEndPos = this.loopEndPositionSelector.determineEndPosition(
      loopType,
      startPos,
      sliceSize
    );

    // Generate partial sequence ending at required position
    const partialSequence =
      await this.partialSequenceGenerator.generatePartialSequence(
        startPos,
        requiredEndPos,
        sliceSize,
        options
      );

    // Execute LOOP to complete the circle
    const circularBeats = loopExecutor.executeLOOP(partialSequence, sliceSize);

    // Build sequence data
    const word = this.metadataService.calculateWordFromBeats(
      circularBeats.slice(1)
    ); // Exclude start position
    const metadata = this.metadataService.createGenerationMetadata({
      stepsGenerated: circularBeats.length - 1,
      propContinuity: options.propContinuity || PropContinuity.CONTINUOUS,
      blueRotationDirection: "",
      redRotationDirection: "",
      turnIntensity: options.turnIntensity || 1,
      level: this.metadataService.mapDifficultyToLevel(options.difficulty),
    });

    const { createSequenceData } =
      await import("$lib/shared/foundation/domain/models/SequenceData");

    // Convert first beat (start position stored as StepData) to proper StartPositionData
    const startPositionStep = circularBeats[0]
      ? createStartPositionFromStepEnd(circularBeats[0])
      : undefined;

    const sequence = createSequenceData({
      name: `Circular ${word}`,
      word,
      steps: circularBeats.slice(1), // Exclude start position beat
      ...(startPositionStep && { startingPosition: startPositionStep }),
      ...(startPositionStep && { startPosition: startPositionStep }),
      gridMode: options.gridMode,
      // propType removed - prop type is viewer preference, not sequence data
      difficultyLevel: options.difficulty,
      isFavorite: false,
      isCircular: true,
      tags: ["circular", "cap", loopType.replace("_", "-")],
      metadata,
    });

    return this.ReversalDetector.processReversals(sequence);
  }

  /**
   * Convert PictographData from customize options to StartPositionData
   * The PictographData from the position picker already has all the needed data,
   * we just add the isStartPosition flag to make it a valid StartPositionData.
   */
  private convertPictographToStartPosition(
    pictograph: PictographData
  ): StartPositionData {
    return {
      ...pictograph,
      isStartPosition: true as const,
      id: pictograph.id || `start-${Date.now()}`,
      gridPosition: pictograph.startPosition || null,
    };
  }
}
