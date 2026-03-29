/**
 * Strict Inverted LOOP Executor
 *
 * Executes the strict inverted LOOP (Linked Orbital Offset Pattern) by:
 * 1. Taking a partial sequence (always first half - no quartering)
 * 2. Using inverted letters (opposite motion types)
 * 3. Generating the remaining steps to complete the circular pattern
 *
 * The inverted transformation works by:
 * - Using inverted letters (A↔B, D↔E, G↔H, etc.)
 * - Flipping motion types (PRO ↔ ANTI)
 * - Flipping prop rotation directions (CLOCKWISE ↔ COUNTER_CLOCKWISE)
 * - Keeping positions the same (sequence returns to start position)
 * - Maintaining the same hand locations
 *
 * IMPORTANT: Slice size is ALWAYS halved (no user choice like ROTATED)
 * IMPORTANT: End position must equal start position for inverted LOOPs
 */

import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import {
  MotionType,
  MotionColor,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { IOrientationCalculator } from "$lib/shared/pictograph/prop/services/contracts/IOrientationCalculator";
import {
  INVERTED_LOOP_VALIDATION_SET,
  getInvertedLetter,
} from "../../domain/constants/strict-loop-position-maps";
import type { SliceSize } from "../../domain/models/circular-models";

export class StrictInvertedLOOPExecutor {
  constructor(private OrientationCalculator: IOrientationCalculator) {}

  /**
   * Execute the strict inverted LOOP
   *
   * @param sequence - The partial sequence to complete (must include start position at index 0)
   * @param sliceSize - Ignored (inverted LOOP always uses halved)
   * @returns The complete circular sequence with all steps
   */
  executeLOOP(sequence: StepData[], _sliceSize: SliceSize): StepData[] {
    // Validate the sequence
    this._validateSequence(sequence);

    // Remove start position (index 0) for processing
    const startPosition = sequence.shift();
    if (!startPosition) {
      throw new Error("Sequence must have a start position");
    }

    // Calculate how many steps to generate (always doubles for inverted)
    const sequenceLength = sequence.length;
    const entriesToAdd = sequenceLength; // Always halved = doubles the sequence

    // Generate the new steps
    const generatedSteps: StepData[] = [];
    let lastStep = sequence[sequence.length - 1]!;
    const nextStepNumber = lastStep.stepNumber + 1;

    // Skip first two steps in the loop (start from beat 2)
    for (let i = 2; i < sequenceLength + 2; i++) {
      const finalIntendedLength = sequenceLength + entriesToAdd;
      const nextStep = this._createNewLOOPEntry(
        sequence,
        lastStep,
        nextStepNumber + i - 2,
        finalIntendedLength
      );

      generatedSteps.push(nextStep);
      sequence.push(nextStep);
      lastStep = nextStep;
    }

    // Re-insert start position at the beginning
    sequence.unshift(startPosition);

    return sequence;
  }

  /**
   * Validate that the sequence can perform a inverted LOOP
   * Requirement: end_position === start_position (returns to start)
   */
  private _validateSequence(sequence: StepData[]): void {
    if (sequence.length < 2) {
      throw new Error(
        "Sequence must have at least 2 steps (start position + 1 beat)"
      );
    }

    const startPos = sequence[0]!.startPosition;
    const endPos = sequence[sequence.length - 1]!.endPosition;

    if (!startPos || !endPos) {
      throw new Error("Sequence steps must have valid start and end positions");
    }

    // Check if the (start, end) pair is valid for inverted (must be same)
    const key = `${startPos},${endPos}`;

    if (!INVERTED_LOOP_VALIDATION_SET.has(key)) {
      throw new Error(
        `Invalid position pair for inverted LOOP: ${startPos} → ${endPos}. ` +
          `For a inverted LOOP, the sequence must end at the same position it started (${startPos}).`
      );
    }
  }

  /**
   * Create a new LOOP entry by transforming a previous beat
   */
  private _createNewLOOPEntry(
    sequence: StepData[],
    previousStep: StepData,
    stepNumber: number,
    finalIntendedLength: number
  ): StepData {
    // Get the corresponding beat from the first section using index mapping
    const previousMatchingStep = this._getPreviousMatchingBeat(
      sequence,
      stepNumber,
      finalIntendedLength
    );

    // Get inverted letter
    const invertedLetter = this._getInvertedLetter(previousMatchingStep);

    // Create the new beat with inverted attributes
    const newStep: StepData = {
      ...previousMatchingStep,
      id: `beat-${stepNumber}`,
      stepNumber,
      letter: invertedLetter,
      startPosition: previousStep.endPosition ?? null,
      endPosition: previousMatchingStep.endPosition ?? null, // Same as matching beat
      motions: {
        [MotionColor.BLUE]: this._createInvertedMotion(
          MotionColor.BLUE,
          previousStep,
          previousMatchingStep
        ),
        [MotionColor.RED]: this._createInvertedMotion(
          MotionColor.RED,
          previousStep,
          previousMatchingStep
        ),
      },
    };

    // Update orientations
    const stepWithStartOri = this.OrientationCalculator.updateStartOrientations(
      newStep,
      previousStep
    );
    const finalStep =
      this.OrientationCalculator.updateEndOrientations(stepWithStartOri);

    return finalStep;
  }

  /**
   * Get the previous matching beat using index mapping (halved pattern)
   */
  private _getPreviousMatchingBeat(
    sequence: StepData[],
    stepNumber: number,
    finalLength: number
  ): StepData {
    const indexMap = this._getIndexMap(finalLength);
    const matchingStepNumber = indexMap[stepNumber];

    if (matchingStepNumber === undefined) {
      throw new Error(`No index mapping found for stepNumber ${stepNumber}`);
    }

    // Convert 1-based stepNumber to 0-based array index
    const arrayIndex = matchingStepNumber - 1;

    if (arrayIndex < 0 || arrayIndex >= sequence.length) {
      throw new Error(
        `Invalid index mapping: stepNumber ${stepNumber} → matchingStepNumber ${matchingStepNumber} → arrayIndex ${arrayIndex} (sequence length: ${sequence.length})`
      );
    }

    return sequence[arrayIndex]!;
  }

  /**
   * Generate index mapping for retrieving corresponding steps (halved pattern only)
   * Maps second half steps to first half steps
   */
  private _getIndexMap(length: number): Record<number, number> {
    const map: Record<number, number> = {};
    const halfLength = Math.floor(length / 2);

    // Map steps in second half to their corresponding steps in first half
    for (let i = halfLength + 1; i <= length; i++) {
      map[i] = i - halfLength;
    }

    return map;
  }

  /**
   * Get inverted letter
   */
  private _getInvertedLetter(previousMatchingStep: StepData): Letter {
    const letter = previousMatchingStep.letter;

    if (!letter) {
      throw new Error("Previous matching beat must have a letter");
    }

    const invertedLetter = getInvertedLetter(letter as string) as Letter;

    return invertedLetter;
  }

  /**
   * Create inverted motion data for the new beat
   * Flips motion type (PRO ↔ ANTI) and prop rotation direction
   */
  private _createInvertedMotion(
    color: MotionColor,
    previousStep: StepData,
    previousMatchingStep: StepData
  ): MotionData {
    const previousMotion = previousStep.motions[color];
    const matchingMotion = previousMatchingStep.motions[color];

    if (!previousMotion || !matchingMotion) {
      throw new Error(`Missing motion data for ${color}`);
    }

    // Flip the motion type (PRO ↔ ANTI)
    const invertedMotionType = this._getInvertedMotionType(
      matchingMotion.motionType as MotionType
    );

    // Flip the prop rotation direction (FIXED: use rotationDirection not propRotationDirection)
    const invertedPropRotDir = this._getInvertedPropRotDir(
      matchingMotion.rotationDirection as RotationDirection
    );

    // Create inverted motion
    const invertedMotion = {
      ...matchingMotion,
      motionType: invertedMotionType,
      startLocation: previousMotion.endLocation,
      endLocation: matchingMotion.endLocation, // Same as matching beat
      rotationDirection: invertedPropRotDir,
      // Start orientation will be set by OrientationCalculator
      // End orientation will be calculated by OrientationCalculator
    };

    return invertedMotion;
  }

  /**
   * Get inverted motion type (flip PRO ↔ ANTI)
   * Other motion types (FLOAT, DASH, STATIC) remain unchanged
   */
  private _getInvertedMotionType(motionType: MotionType): MotionType {
    if (motionType === MotionType.PRO) {
      return MotionType.ANTI;
    } else if (motionType === MotionType.ANTI) {
      return MotionType.PRO;
    }

    // FLOAT, DASH, STATIC stay the same
    return motionType;
  }

  /**
   * Get inverted prop rotation direction (flip CLOCKWISE ↔ COUNTER_CLOCKWISE)
   * NO_ROTATION stays NO_ROTATION
   */
  private _getInvertedPropRotDir(
    propRotDir: RotationDirection
  ): RotationDirection {
    if (propRotDir === RotationDirection.CLOCKWISE) {
      return RotationDirection.COUNTER_CLOCKWISE;
    } else if (propRotDir === RotationDirection.COUNTER_CLOCKWISE) {
      return RotationDirection.CLOCKWISE;
    }

    // NO_ROTATION stays NO_ROTATION
    return propRotDir;
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
import { orientationCalculator } from "$lib/shared/pictograph/prop/services/implementations/OrientationCalculator";

export const strictInvertedLOOPExecutor = new StrictInvertedLOOPExecutor(
  orientationCalculator
);
