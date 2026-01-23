/**
 * Random Sequence Generator Implementation
 *
 * Generates single random valid sequences using constraint-based random walks.
 * Fast alternative to exhaustive exploration.
 */

import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { SequenceData } from "$lib/features/create/shared/domain/models/SequenceData";
import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { VariationConstraints } from "../../domain/models/spell-models";
import type {
  IRandomSequenceGenerator,
  RandomSequenceGenerationOptions,
} from "../contracts/IRandomSequenceGenerator";
import type { ILetterQueryHandler } from "$lib/shared/pictograph/shared/services/contracts/ILetterQueryHandler";
import type { IStartPositionValidator } from "../contracts/IStartPositionValidator";
import type { IOrientationContinuityValidator } from "../contracts/IOrientationContinuityValidator";
import type { IOrientationCalculator } from "$lib/shared/pictograph/orientation/services/contracts/IOrientationCalculator";
import type { ISequenceExtender } from "$lib/features/create/shared/services/contracts/ISequenceExtender";
import type { IStepConverter } from "$lib/features/create/generate/shared/services/contracts/IStepConverter";
import type { IReversalDetector } from "$lib/features/create/shared/services/contracts/IReversalDetector";
import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";
import { MotionType } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { createSequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { recalculateAllOrientations } from "$lib/features/create/shared/services/implementations/sequence-transforms/orientation-propagation";

interface RandomWalkState {
  steps: StepData[];
  pictographs: PictographData[];
  letterIndex: number;
  startPositionPictograph: PictographData;
}

export class RandomSequenceGenerator implements IRandomSequenceGenerator {
  constructor(
    private letterQueryHandler: ILetterQueryHandler,
    private startPositionValidator: IStartPositionValidator,
    private orientationContinuityValidator: IOrientationContinuityValidator,
    private orientationCalculator: IOrientationCalculator,
    private sequenceExtender: ISequenceExtender,
    private stepConverter: IStepConverter,
    private reversalDetector: IReversalDetector
  ) {}

  async generateRandomSequence(
    letters: Letter[],
    options: RandomSequenceGenerationOptions
  ): Promise<SequenceData | null> {
    const { gridMode, constraints, signal, maxAttempts = 100 } = options;

    if (letters.length === 0) {
      return null;
    }

    // Try multiple times to find a valid sequence
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (signal?.aborted) {
        return null;
      }

      try {
        const sequence = await this.attemptRandomGeneration(
          letters,
          gridMode,
          constraints,
          signal
        );

        if (sequence) {
          return sequence;
        }
      } catch (error) {
        // If there are no valid start positions, retrying won't help
        if (error instanceof Error && error.message.includes("No valid start positions")) {
          console.error(
            `[RandomSequenceGenerator] Cannot generate sequence: ${error.message}`
          );
          return null;
        }

        console.warn(
          `[RandomSequenceGenerator] Attempt ${attempt + 1} failed:`,
          error
        );
        // Continue to next attempt for other errors
      }
    }

    console.error(
      `[RandomSequenceGenerator] Failed to generate valid sequence after ${maxAttempts} attempts`
    );
    return null;
  }

  private async attemptRandomGeneration(
    letters: Letter[],
    gridMode: GridMode,
    constraints?: VariationConstraints,
    signal?: AbortSignal
  ): Promise<SequenceData | null> {
    // Get ALL pictograph variations for this grid mode (cached by letterQueryHandler)
    const allPictographs = await this.letterQueryHandler.getAllPictographVariations(
      gridMode
    );

    // Get the first letter of the word
    const firstLetter = letters[0];
    if (!firstLetter) return null;

    // Step 1: Pick a random variation of the first letter
    const firstLetterVariations = allPictographs.filter(
      (p) => p.letter === firstLetter
    );

    if (firstLetterVariations.length === 0) {
      return null;
    }

    const firstLetterVariation = this.pickRandom(firstLetterVariations);
    if (!firstLetterVariation) return null;

    // Step 2: Get where that variation starts (e.g., "alpha3")
    const requiredStartPosition = firstLetterVariation.startPosition;

    // Step 3: Validate that a Type 6 static letter exists at that position
    // (The start position will be derived, not stored as a beat)
    const validStartPositions = allPictographs.filter((p) => {
      return (
        this.startPositionValidator.isValidStartPosition(p) &&
        p.startPosition === requiredStartPosition &&
        p.endPosition === requiredStartPosition
      );
    });

    if (validStartPositions.length === 0) {
      console.warn(
        `[RandomSequenceGenerator] No Type 6 static letter found at position ${requiredStartPosition} for letter ${firstLetter}`
      );
      return null;
    }

    // Pick a random start position (Type 6 static letter)
    const startPositionPictograph = this.pickRandom(validStartPositions);
    if (!startPositionPictograph) return null;

    // Step 4: Convert first letter variation to beat 1
    const firstLetterStep = this.stepConverter.convertToStep(
      firstLetterVariation,
      1,
      gridMode
    );

    // Initialize walk state with first letter and start position
    const state: RandomWalkState = {
      steps: [firstLetterStep],
      pictographs: [firstLetterVariation],
      letterIndex: 1, // Start from second letter (index 1) since first is already placed
      startPositionPictograph,
    };

    // Walk through remaining letters
    while (state.letterIndex < letters.length) {
      if (signal?.aborted) {
        return null;
      }

      const success = this.walkNextLetter(
        letters,
        state,
        gridMode,
        allPictographs,
        constraints
      );

      if (!success) {
        console.warn(
          `[RandomSequenceGenerator] Failed at letter ${state.letterIndex}/${letters.length}: ${letters[state.letterIndex]}`
        );
        return null; // Failed to find valid next step
      }

      state.letterIndex++;
    }

    // Build final sequence with proper start position for orientation propagation
    const sequence = this.buildSequence(
      state.steps,
      gridMode,
      state.startPositionPictograph
    );

    // Apply LOOP extension if circular is required
    if (constraints?.requiresCircular && !sequence.isCircular) {
      const extended = await this.applyCircularExtension(sequence, constraints);
      return extended || sequence;
    }

    return sequence;
  }

  private walkNextLetter(
    letters: Letter[],
    state: RandomWalkState,
    gridMode: GridMode,
    allPictographs: PictographData[],
    constraints?: VariationConstraints
  ): boolean {
    const letter = letters[state.letterIndex];
    if (!letter) return false;

    const lastPictograph = state.pictographs[state.pictographs.length - 1];
    if (!lastPictograph) return false;

    // Get all variations for this letter
    const variations = allPictographs.filter((p) => p.letter === letter);

    // Filter by position continuity and constraints
    const lastEndPosition = lastPictograph.endPosition;

    let validOptions = variations.filter((pictograph) => {
      // Check position continuity: next beat must start where last beat ended
      const nextStartPosition = pictograph.startPosition;

      if (lastEndPosition !== nextStartPosition) {
        return false; // Position break - invalid transition
      }

      // Apply constraints
      return this.meetsConstraints(pictograph, constraints);
    });

    if (validOptions.length === 0) {
      console.warn(
        `[RandomSequenceGenerator] No valid options for ${letter}.`,
        `\n  Last beat: ${lastPictograph.letter} ended at: ${lastEndPosition}`,
        `\n  Need ${letter} starting at: ${lastEndPosition}`,
        `\n  Total ${letter} variations: ${variations.length}`,
        `\n  After position filter: ${validOptions.length}`,
        `\n  Available ${letter} start positions:`, variations.map(v => v.startPosition).join(', ')
      );
      return false; // No valid options - this path is blocked
    }

    // Randomly pick one valid option
    const chosenPictograph = this.pickRandom(validOptions);
    if (!chosenPictograph) return false;

    // Convert to step and add to state
    const step = this.stepConverter.convertToStep(
      chosenPictograph,
      state.steps.length + 1,
      gridMode
    );

    state.steps.push(step);
    state.pictographs.push(chosenPictograph);

    return true;
  }

  private meetsConstraints(
    pictograph: PictographData,
    constraints?: VariationConstraints
  ): boolean {
    if (!constraints) return true;

    // Motion type filter
    if (constraints.motionTypeFilter) {
      const hasDash = this.hasDashMotion(pictograph);

      if (constraints.motionTypeFilter === "dash" && !hasDash) {
        return false;
      }

      if (constraints.motionTypeFilter === "no-dash" && hasDash) {
        return false;
      }
    }

    // Note: We can't check reversal count or step count on individual pictographs
    // Those are sequence-level constraints checked after generation completes

    return true;
  }

  private hasDashMotion(pictograph: PictographData): boolean {
    const blueMotion = pictograph.blueMotion;
    const redMotion = pictograph.redMotion;

    return (
      blueMotion?.motionType === MotionType.DASH ||
      redMotion?.motionType === MotionType.DASH
    );
  }

  private buildSequence(
    steps: StepData[],
    gridMode: GridMode,
    startPositionPictograph: PictographData
  ): SequenceData {
    // Extract word from step letters
    const word = steps
      .map((step) => step.letter || "")
      .filter((letter) => letter)
      .join("");

    // Convert the start position pictograph to StartPositionData
    const startPosition = this.stepConverter.convertToStartPosition(
      startPositionPictograph,
      gridMode
    );

    // Create the initial sequence with start position
    let sequence = createSequenceData({
      steps,
      name: word,
      word: word,
      gridMode,
      isCircular: false,
      startPosition,
      metadata: {
        generatedAt: new Date().toISOString(),
        generationMethod: "random-walk",
      },
    });

    // Recalculate all orientations using proper propagation
    // This uses the start position's end orientations as the baseline
    // and calculates each step's end orientation based on motion type
    sequence = recalculateAllOrientations(sequence, this.orientationCalculator);

    // Detect and apply reversal markers
    sequence = this.reversalDetector.processReversals(sequence);

    return sequence;
  }

  private async applyCircularExtension(
    sequence: SequenceData,
    constraints?: VariationConstraints
  ): Promise<SequenceData | null> {
    if (!constraints?.requiresCircular) return sequence;

    try {
      // Use specified LOOP type, or default to REWOUND
      const loopType = constraints.loopType ?? "REWOUND";
      const extended = await this.sequenceExtender.extendSequence(
        sequence,
        loopType
      );

      return extended || sequence;
    } catch (error) {
      console.error(
        "[RandomSequenceGenerator] Failed to apply circular extension:",
        error
      );
      return sequence;
    }
  }

  private pickRandom<T>(items: T[]): T | null {
    if (items.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * items.length);
    return items[randomIndex] ?? null;
  }
}
