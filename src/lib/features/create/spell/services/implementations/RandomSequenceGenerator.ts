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
import { MotionType } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

interface RandomWalkState {
  steps: StepData[];
  pictographs: PictographData[];
  letterIndex: number;
}

export class RandomSequenceGenerator implements IRandomSequenceGenerator {
  constructor(
    private letterQueryHandler: ILetterQueryHandler,
    private startPositionValidator: IStartPositionValidator,
    private orientationContinuityValidator: IOrientationContinuityValidator,
    private orientationCalculator: IOrientationCalculator,
    private sequenceExtender: ISequenceExtender,
    private stepConverter: IStepConverter
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

    console.log(`[RandomSequenceGenerator] Total pictographs available: ${allPictographs.length}`);

    // Get the first letter of the word
    const firstLetter = letters[0];
    if (!firstLetter) return null;

    console.log(`[RandomSequenceGenerator] Generating for word starting with: ${firstLetter}`);

    // Step 1: Pick a random variation of the first letter
    const firstLetterVariations = allPictographs.filter(
      (p) => p.letter === firstLetter
    );

    console.log(`[RandomSequenceGenerator] Found ${firstLetterVariations.length} variations of letter ${firstLetter}`);

    if (firstLetterVariations.length === 0) {
      console.warn(`[RandomSequenceGenerator] No variations found for letter ${firstLetter}`);
      return null;
    }

    const firstLetterVariation = this.pickRandom(firstLetterVariations);
    if (!firstLetterVariation) return null;

    // Step 2: Get where that variation starts (e.g., "alpha3")
    const requiredStartPosition = firstLetterVariation.startPosition;
    console.log(`[RandomSequenceGenerator] First letter ${firstLetter} starts at: ${requiredStartPosition}`);

    // Step 3: Find Type 6 static letters at that position
    const validStartPositions = allPictographs.filter((p) => {
      return (
        this.startPositionValidator.isValidStartPosition(p) &&
        p.startPosition === requiredStartPosition &&
        p.endPosition === requiredStartPosition
      );
    });

    console.log(`[RandomSequenceGenerator] Found ${validStartPositions.length} Type 6 static letters at ${requiredStartPosition}`);

    if (validStartPositions.length === 0) {
      console.warn(
        `[RandomSequenceGenerator] No Type 6 static letter found at position ${requiredStartPosition} for letter ${firstLetter}`
      );
      return null;
    }

    // Step 4: Randomly pick a static start position
    const startPictograph = this.pickRandom(validStartPositions);
    if (!startPictograph) return null;

    // Convert start position to step (beat 1)
    const startStep = this.stepConverter.convertToStep(
      startPictograph,
      1,
      gridMode
    );

    // Convert first letter variation to step (beat 2)
    const firstLetterStep = this.stepConverter.convertToStep(
      firstLetterVariation,
      2,
      gridMode
    );

    // Initialize walk state with both start position and first letter
    const state: RandomWalkState = {
      steps: [startStep, firstLetterStep],
      pictographs: [startPictograph, firstLetterVariation],
      letterIndex: 1, // Start from second letter (index 1) since first is already placed
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
        return null; // Failed to find valid next step
      }

      state.letterIndex++;
    }

    // Build final sequence
    const sequence = this.buildSequence(state.steps, gridMode);
    console.log(`[RandomSequenceGenerator] ✅ Successfully generated sequence with ${sequence.steps.length} steps`);

    // Apply LOOP extension if circular is required
    if (constraints?.requiresCircular && !sequence.isCircular) {
      const extended = await this.applyCircularExtension(
        sequence,
        constraints.requiresCircular
      );
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
    console.log(`[RandomSequenceGenerator] Letter ${letter} at position ${state.letterIndex}: ${variations.length} total variations`);

    // Filter by position continuity and constraints
    let validOptions = variations.filter((pictograph) => {
      // Check position continuity: next beat must start where last beat ended
      const lastEndPosition = lastPictograph.endPosition;
      const nextStartPosition = pictograph.startPosition;

      if (lastEndPosition !== nextStartPosition) {
        return false; // Position break - invalid transition
      }

      // Apply constraints
      return this.meetsConstraints(pictograph, constraints);
    });

    console.log(`[RandomSequenceGenerator] Letter ${letter}: ${validOptions.length} valid options after filtering`);

    if (validOptions.length === 0) {
      console.warn(`[RandomSequenceGenerator] No valid options for letter ${letter} at position ${state.letterIndex} - path blocked`);
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

  private buildSequence(steps: StepData[], gridMode: GridMode): SequenceData {
    // Recalculate all orientations to ensure consistency
    const stepsWithOrientations = steps.map((step, index) => {
      if (index === 0) return step;

      const previousStep = steps[index - 1];
      if (!previousStep) return step;

      // Recalculate orientations based on previous step
      const blueStartOrientation =
        previousStep.blueMotion?.endOrientation ||
        step.blueMotion?.startOrientation;
      const redStartOrientation =
        previousStep.redMotion?.endOrientation ||
        step.redMotion?.startOrientation;

      return {
        ...step,
        blueMotion: step.blueMotion
          ? {
              ...step.blueMotion,
              startOrientation:
                blueStartOrientation || step.blueMotion.startOrientation,
            }
          : undefined,
        redMotion: step.redMotion
          ? {
              ...step.redMotion,
              startOrientation:
                redStartOrientation || step.redMotion.startOrientation,
            }
          : undefined,
      };
    });

    return {
      steps: stepsWithOrientations,
      gridMode,
      isCircular: false,
      metadata: {
        generatedAt: new Date().toISOString(),
        generationMethod: "random-walk",
      },
    };
  }

  private async applyCircularExtension(
    sequence: SequenceData,
    requiresCircular: boolean
  ): Promise<SequenceData | null> {
    if (!requiresCircular) return sequence;

    try {
      // Use sequence extender to apply LOOP
      const extended = await this.sequenceExtender.extendSequence(
        sequence,
        "REWOUND" // Default LOOP type - TODO: make configurable
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
