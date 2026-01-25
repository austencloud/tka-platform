/**
 * Random Sequence Generator Implementation
 *
 * Generates single random valid sequences using constraint-based random walks.
 * Fast alternative to exhaustive exploration.
 */

import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { VariationConstraints } from "../../domain/models/spell-models";
import type {
  IRandomSequenceGenerator,
  RandomSequenceGenerationOptions,
} from "../contracts/IRandomSequenceGenerator";
import type { ILetterQueryHandler } from "$lib/shared/foundation/services/contracts/data/data-contracts";
import type { IStartPositionValidator } from "../contracts/IStartPositionValidator";
import type { IOrientationContinuityValidator } from "../contracts/IOrientationContinuityValidator";
import type { IOrientationCalculator } from "$lib/shared/pictograph/prop/services/contracts/IOrientationCalculator";
import type { ISequenceExtender } from "$lib/features/create/shared/services/contracts/ISequenceExtender";
import type { IStepConverter } from "$lib/features/create/generate/shared/services/contracts/IStepConverter";
import type { IReversalDetector } from "$lib/features/create/shared/services/contracts/IReversalDetector";
import { LOOPType } from "$lib/features/create/generate/circular/domain/models/circular-models";
import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";
import type { ConstraintSet, ConstraintStep, ConstraintPictographData } from "$lib/shared/sequence-engine/constraints/types";
import { MotionType, MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { createSequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { recalculateAllOrientations } from "$lib/features/create/shared/services/implementations/sequence-transforms/orientation-propagation";

interface RandomWalkState {
  steps: StepData[];
  pictographs: PictographData[];
  letterIndex: number;
  startPositionPictograph: PictographData;
  /** Track previous steps for constraint scoring (reversals, continuity) */
  previousConstraintSteps: ConstraintStep[];
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
    const { gridMode, constraints, constraintSet, signal, maxAttempts = 100 } = options;

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
          constraintSet,
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
    constraintSet?: ConstraintSet,
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
      (p: PictographData) => p.letter === firstLetter
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

    // Convert first letter variation to ConstraintStep for soft constraint scoring
    const firstConstraintStep = this.pictographToConstraintStep(firstLetterVariation);

    // Initialize walk state with first letter and start position
    const state: RandomWalkState = {
      steps: [firstLetterStep],
      pictographs: [firstLetterVariation],
      letterIndex: 1, // Start from second letter (index 1) since first is already placed
      startPositionPictograph,
      previousConstraintSteps: [firstConstraintStep],
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
        constraints,
        constraintSet
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
    constraints?: VariationConstraints,
    constraintSet?: ConstraintSet
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

    // Use constraint-weighted selection if soft constraints are provided
    const chosenPictograph = this.selectWithConstraints(
      validOptions,
      state.previousConstraintSteps,
      constraintSet,
      constraints
    );
    if (!chosenPictograph) return false;

    // Convert to step and add to state
    const step = this.stepConverter.convertToStep(
      chosenPictograph,
      state.steps.length + 1,
      gridMode
    );

    state.steps.push(step);
    state.pictographs.push(chosenPictograph);

    // Track this step for constraint scoring in next iteration
    const constraintStep = this.pictographToConstraintStep(chosenPictograph);
    state.previousConstraintSteps.push(constraintStep);

    return true;
  }

  private meetsConstraints(
    pictograph: PictographData,
    constraints?: VariationConstraints
  ): boolean {
    if (!constraints) return true;

    // Motion type filter - only "no-dash" is a hard constraint
    // "prefer-dash" is a soft preference handled in selectWithConstraints
    if (constraints.motionTypeFilter === "no-dash") {
      const hasDash = this.hasDashMotion(pictograph);
      if (hasDash) {
        return false;
      }
    }

    // Note: We can't check reversal count or step count on individual pictographs
    // Those are sequence-level constraints checked after generation completes

    return true;
  }

  private hasDashMotion(pictograph: PictographData): boolean {
    const blueMotion = pictograph.motions[MotionColor.BLUE];
    const redMotion = pictograph.motions[MotionColor.RED];

    return (
      blueMotion?.motionType === MotionType.DASH ||
      redMotion?.motionType === MotionType.DASH
    );
  }

  /**
   * Convert a pictograph to the ConstraintStep format used for scoring.
   */
  private pictographToConstraintStep(pictograph: PictographData): ConstraintStep {
    const blueMotion = pictograph.motions[MotionColor.BLUE];
    const redMotion = pictograph.motions[MotionColor.RED];

    return {
      letter: pictograph.letter ?? "",
      blueMotionType: blueMotion?.motionType ?? "static",
      redMotionType: redMotion?.motionType ?? "static",
      bluePropRotation: blueMotion?.rotationDirection ?? "cw",
      redPropRotation: redMotion?.rotationDirection ?? "cw",
      startPosition: pictograph.startPosition ?? "",
      endPosition: pictograph.endPosition ?? "",
      // Location data for hand path constraint
      blueStartLocation: blueMotion?.startLocation ?? "",
      blueEndLocation: blueMotion?.endLocation ?? "",
      redStartLocation: redMotion?.startLocation ?? "",
      redEndLocation: redMotion?.endLocation ?? "",
    };
  }

  /**
   * Convert a pictograph to the ConstraintPictographData format for constraint evaluation.
   */
  private pictographToConstraintPictograph(pictograph: PictographData): ConstraintPictographData {
    const blueMotion = pictograph.motions[MotionColor.BLUE];
    const redMotion = pictograph.motions[MotionColor.RED];

    return {
      letter: pictograph.letter ?? "",
      startPosition: pictograph.startPosition ?? "",
      endPosition: pictograph.endPosition ?? "",
      timing: "", // PictographData doesn't have timing - only available on compound letters
      direction: "", // PictographData doesn't have direction - only available on compound letters
      blueMotion: {
        color: "blue",
        startLocation: blueMotion?.startLocation ?? "",
        endLocation: blueMotion?.endLocation ?? "",
        motionType: blueMotion?.motionType ?? "static",
        rotationDirection: blueMotion?.rotationDirection ?? "cw",
        startOrientation: blueMotion?.startOrientation ?? "",
        endOrientation: blueMotion?.endOrientation ?? "",
      },
      redMotion: {
        color: "red",
        startLocation: redMotion?.startLocation ?? "",
        endLocation: redMotion?.endLocation ?? "",
        motionType: redMotion?.motionType ?? "static",
        rotationDirection: redMotion?.rotationDirection ?? "cw",
        startOrientation: redMotion?.startOrientation ?? "",
        endOrientation: redMotion?.endOrientation ?? "",
      },
    };
  }

  /**
   * Convert a ConstraintStep to ConstraintPictographData for constraint evaluation.
   */
  private constraintStepToConstraintPictograph(step: ConstraintStep): ConstraintPictographData {
    return {
      letter: step.letter,
      startPosition: step.startPosition,
      endPosition: step.endPosition,
      timing: "",
      direction: "",
      blueMotion: {
        color: "blue",
        startLocation: step.blueStartLocation ?? "",
        endLocation: step.blueEndLocation ?? "",
        motionType: step.blueMotionType,
        rotationDirection: step.bluePropRotation,
        startOrientation: "",
        endOrientation: "",
      },
      redMotion: {
        color: "red",
        startLocation: step.redStartLocation ?? "",
        endLocation: step.redEndLocation ?? "",
        motionType: step.redMotionType,
        rotationDirection: step.redPropRotation,
        startOrientation: "",
        endOrientation: "",
      },
    };
  }

  /**
   * Select a candidate using weighted scoring based on soft constraints.
   * If no constraintSet is provided, falls back to random selection.
   * Also applies preference boosts (e.g., prefer-dash).
   */
  private selectWithConstraints(
    candidates: PictographData[],
    previousSteps: ConstraintStep[],
    constraintSet?: ConstraintSet,
    variationConstraints?: VariationConstraints
  ): PictographData | null {
    if (candidates.length === 0) return null;

    const preferDash = variationConstraints?.motionTypeFilter === "prefer-dash";

    // If prefer-dash is on, filter to only dash options when available
    if (preferDash) {
      const dashCandidates = candidates.filter((c) => this.hasDashMotion(c));
      if (dashCandidates.length > 0) {
        // Use only dash candidates for the rest of selection
        candidates = dashCandidates;
      }
      // If no dash candidates exist, fall through to use all candidates
    }

    // Check if we need to apply any scoring
    const hasSoftConstraints = constraintSet?.soft && constraintSet.soft.length > 0;

    // No soft constraints - use pure random selection from remaining candidates
    if (!hasSoftConstraints) {
      return this.pickRandom(candidates);
    }

    // Score each candidate based on soft constraints
    const scored = candidates.map((candidate, index) => {
      const candidatePictograph = this.pictographToConstraintPictograph(candidate);
      const previousPictographs = previousSteps.map((step) =>
        this.constraintStepToConstraintPictograph(step)
      );

      let score = 0;

      for (const constraint of constraintSet!.soft!) {
        // Build ConstraintContext for the evaluate method
        const context = {
          stepIndex: previousSteps.length,
          totalSteps: previousSteps.length + 1,
          previousSteps: previousPictographs,
          candidate: candidatePictograph,
          letter: candidate.letter ?? "",
        };

        const result = constraint.evaluate(context);
        const weight = constraintSet!.weights?.get(constraint.type) ?? 1;
        score += result.score * weight;
      }

      return { candidate, score };
    });

    // Weighted random selection based on scores
    // Convert scores to positive weights (higher score = better = higher weight)
    const minScore = Math.min(...scored.map((s) => s.score));
    const weights = scored.map((s) => ({
      candidate: s.candidate,
      weight: Math.max(0.01, s.score - minScore + 1), // Ensure positive weights
    }));

    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
    let random = Math.random() * totalWeight;

    for (const { candidate, weight } of weights) {
      random -= weight;
      if (random <= 0) {
        return candidate;
      }
    }

    // Fallback to last candidate (shouldn't happen with proper weights)
    return candidates[candidates.length - 1] ?? null;
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
      const loopType = constraints.loopType ?? LOOPType.REWOUND;
      const extended = await this.sequenceExtender.extendSequence(
        sequence,
        { loopType }
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

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
import { letterQueryHandler } from "$lib/shared/pictograph/tka-glyph/services/implementations/LetterQueryHandler";
import { startPositionValidator } from "./StartPositionValidator";
import { orientationContinuityValidator } from "./OrientationContinuityValidator";
import { orientationCalculator } from "$lib/shared/pictograph/prop/services/implementations/OrientationCalculator";
import { sequenceExtender } from "$lib/features/create/shared/services/implementations/SequenceExtender";
import { stepConverter } from "$lib/features/create/generate/shared/services/implementations/StepConverter";
import { reversalDetector } from "$lib/features/create/shared/services/implementations/ReversalDetector";

export const randomSequenceGenerator = new RandomSequenceGenerator(
  letterQueryHandler,
  startPositionValidator,
  orientationContinuityValidator,
  orientationCalculator,
  sequenceExtender,
  stepConverter,
  reversalDetector
);
