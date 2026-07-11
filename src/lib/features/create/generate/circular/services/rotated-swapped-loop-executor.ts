/**
 * Rotated Swapped LOOP Executor
 *
 * Executes the rotated-swapped LOOP (Linked Orbital Offset Pattern) by combining:
 * 1. SWAPPED: Blue does what Red did, Red does what Blue did
 * 2. ROTATED: Rotate locations based on handpath direction (90°, 180°, or 270°)
 *
 * This creates a sequence where:
 * - Colors are swapped (Blue performs Red's actions and vice versa)
 * - Locations are rotated based on the handpath direction of each color's motion
 * - Motion types stay the same (from opposite color due to swap)
 * - Prop rotation directions stay the same (from opposite color due to swap)
 * - Letters stay the same
 *
 * IMPORTANT: Supports both quartered and halved slice sizes
 * IMPORTANT: End position is calculated from rotated locations
 */

import {
  MotionColor,
  MotionType,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { getGridPositionFromLocations } from "$lib/shared/pictograph/grid/services/grid-position-deriver";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import type {
  GridLocation,
  GridPosition,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  updateStartOrientations,
  updateEndOrientations,
} from "$lib/shared/pictograph/prop/services/orientation-calculator";
import {
  getHandRotationDirection,
  getLocationMapForHandRotation,
} from "../domain/constants/circular-position-maps";
import {
  ROTATED_SWAPPED_QUARTERED_VALIDATION_SET,
  ROTATED_SWAPPED_HALVED_VALIDATION_SET,
} from "../domain/constants/strict-loop-position-maps";
import { Period } from "../domain/models/circular-models";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";

export class RotatedSwappedLOOPExecutor {
  constructor() {}

  /**
   * Execute the rotated-swapped LOOP
   *
   * @param sequence - The partial sequence to complete (must include start position at index 0)
   * @param period - Slice size for the LOOP (quartered or halved)
   * @returns The complete circular sequence with all steps
   */
  executeLOOP(sequence: StepData[], period: Period): StepData[] {
    // Validate the sequence
    this._validateSequence(sequence, period);

    // Remove start position (index 0) for processing
    const startPosition = sequence.shift();
    if (!startPosition) {
      throw new Error("Sequence must have a start position");
    }

    // Calculate how many steps to generate based on slice size
    const sequenceLength = sequence.length;
    let entriesToAdd: number;

    if (period === Period.QUARTERED) {
      // Quartered adds 3x the original length
      entriesToAdd = sequenceLength * 3;
    } else {
      // Halved adds 1x the original length (doubles total)
      entriesToAdd = sequenceLength;
    }

    // Generate the new steps
    const generatedSteps: StepData[] = [];
    let lastStep = sequence[sequence.length - 1]!;
    let nextStepNumber = lastStep.stepNumber + 1;

    // Skip first two steps in the loop (start from beat 2)
    const finalIntendedLength = sequenceLength + entriesToAdd;
    for (let i = 0; i < entriesToAdd; i++) {
      const nextStep = this._createNewLOOPEntry(
        sequence,
        lastStep,
        nextStepNumber,
        finalIntendedLength,
        period
      );

      generatedSteps.push(nextStep);
      sequence.push(nextStep);
      lastStep = nextStep;
      nextStepNumber++;
    }

    // Re-insert start position at the beginning
    sequence.unshift(startPosition);

    return sequence;
  }

  /**
   * Validate that the sequence can perform a rotated-swapped LOOP
   */
  private _validateSequence(sequence: StepData[], period: Period): void {
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

    // Check if the (start, end) pair is valid for the requested slice size.
    // The end position must be SWAPPED(ROTATED(start)) — both the rotation AND
    // the color swap move the position, so pure-rotation sets are insufficient.
    // Matches the canonical LOOPValidator and the UI's loop-validator.
    const key = `${startPos},${endPos}`;
    const validationSet =
      period === Period.QUARTERED
        ? ROTATED_SWAPPED_QUARTERED_VALIDATION_SET
        : ROTATED_SWAPPED_HALVED_VALIDATION_SET;

    if (!validationSet.has(key)) {
      throw new Error(
        `Invalid position pair for rotated-swapped ${period} LOOP: ${startPos} → ${endPos}. ` +
          `The end position must equal SWAPPED(ROTATED(${startPos})) for the ${period} slice size.`
      );
    }
  }

  /**
   * Create a new LOOP entry by transforming a previous beat with SWAP + ROTATION
   */
  private _createNewLOOPEntry(
    sequence: StepData[],
    previousStep: StepData,
    stepNumber: number,
    finalIntendedLength: number,
    period: Period
  ): StepData {
    // Get the corresponding beat from the first section using index mapping
    const previousMatchingStep = this._getPreviousMatchingBeat(
      sequence,
      stepNumber,
      finalIntendedLength,
      period
    );

    // Calculate the rotated end position
    const rotatedEndPosition = this._getRotatedEndPosition(
      previousStep,
      previousMatchingStep
    );

    // Create the new beat with swapped and rotated attributes
    // KEY: Blue gets attributes from Red's matching beat (SWAP)
    //      Red gets attributes from Blue's matching beat (SWAP)
    //      Then locations are rotated based on handpath direction
    const newStep: StepData = {
      ...previousMatchingStep,
      id: `step-${stepNumber}`,
      stepNumber,
      letter: previousMatchingStep.letter ?? null, // Same letter
      startPosition: previousStep.endPosition ?? null,
      endPosition: rotatedEndPosition,
      motions: {
        // SWAP: Blue does what Red did, but with rotated transformation
        [MotionColor.BLUE]: this._createRotatedSwappedMotion(
          MotionColor.BLUE,
          previousStep,
          previousMatchingStep,
          true // isSwapped = true (use opposite color's data)
        ),
        // SWAP: Red does what Blue did, but with rotated transformation
        [MotionColor.RED]: this._createRotatedSwappedMotion(
          MotionColor.RED,
          previousStep,
          previousMatchingStep,
          true // isSwapped = true (use opposite color's data)
        ),
      },
    };

    // Update orientations
    const stepWithStartOri = updateStartOrientations(
      newStep,
      previousStep
    );
    const finalStep =
      updateEndOrientations(stepWithStartOri);

    return finalStep;
  }

  /**
   * Get the previous matching beat using index mapping
   */
  private _getPreviousMatchingBeat(
    sequence: StepData[],
    stepNumber: number,
    finalLength: number,
    period: Period
  ): StepData {
    const indexMap = this._getIndexMap(finalLength, period);
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
   * Generate index mapping for retrieving corresponding steps
   * Works for both quartered and halved patterns
   */
  private _getIndexMap(
    length: number,
    period: Period
  ): Record<number, number> {
    const map: Record<number, number> = {};

    // Edge case handling
    if (period === Period.QUARTERED && length < 4) {
      for (let i = 1; i <= length; i++) {
        map[i] = Math.max(i - 1, 1);
      }
      return map;
    }

    if (period === Period.HALVED && length < 2) {
      for (let i = 1; i <= length; i++) {
        map[i] = Math.max(i - 1, 1);
      }
      return map;
    }

    if (period === Period.QUARTERED) {
      // Quartered: length = base * 4, so base = length / 4
      // Each quarter references the PREVIOUS quarter (chained rotation)
      const baseLength = Math.floor(length / 4);
      for (let i = baseLength + 1; i <= length; i++) {
        map[i] = i - baseLength;
      }
    } else {
      // Halved: length = base * 2, so base = length / 2
      const baseLength = Math.floor(length / 2);
      for (let i = baseLength + 1; i <= length; i++) {
        map[i] = i - baseLength;
      }
    }

    return map;
  }

  /**
   * Get the rotated end position by rotating both colors' locations
   */
  private _getRotatedEndPosition(
    previousStep: StepData,
    previousMatchingStep: StepData
  ): GridPosition | null {
    // Get hand rotation directions from the matching beat (before swap)
    // Blue will use Red's handpath (due to swap)
    // Red will use Blue's handpath (due to swap)
    const blueHandRotDir = getHandRotationDirection(
      previousMatchingStep.motions[MotionColor.RED]!
        .startLocation as GridLocation,
      previousMatchingStep.motions[MotionColor.RED]!.endLocation as GridLocation
    );
    const redHandRotDir = getHandRotationDirection(
      previousMatchingStep.motions[MotionColor.BLUE]!
        .startLocation as GridLocation,
      previousMatchingStep.motions[MotionColor.BLUE]!
        .endLocation as GridLocation
    );

    // Get the location maps for rotation
    const blueLocationMap = getLocationMapForHandRotation(blueHandRotDir);
    const redLocationMap = getLocationMapForHandRotation(redHandRotDir);

    // Rotate the locations from the previous beat
    const newBlueEndLoc =
      blueLocationMap[
        previousStep.motions[MotionColor.BLUE]!.endLocation as GridLocation
      ];
    const newRedEndLoc =
      redLocationMap[
        previousStep.motions[MotionColor.RED]!.endLocation as GridLocation
      ];

    // Derive position from both locations
    const newEndPosition =
      getGridPositionFromLocations(
        newBlueEndLoc,
        newRedEndLoc
      );

    return newEndPosition;
  }

  /**
   * Create rotated-swapped motion data for the new beat
   * Combines color swapping with location rotation
   */
  private _createRotatedSwappedMotion(
    color: MotionColor,
    previousStep: StepData,
    previousMatchingStep: StepData,
    isSwapped: boolean
  ): MotionData {
    // SWAP: Get the opposite color's motion data for the PATTERN
    const oppositeColor =
      color === MotionColor.BLUE ? MotionColor.RED : MotionColor.BLUE;

    // For CONTINUITY: Always use same color from previous beat
    // (Blue continues from where Blue ended, Red continues from where Red ended)
    // The swap affects which PATTERN to follow, not where to continue from
    const previousMotion = previousStep.motions[color];

    // For PATTERN: When swapped, this color follows the opposite color's movement pattern
    const matchingMotion = isSwapped
      ? previousMatchingStep.motions[oppositeColor]
      : previousMatchingStep.motions[color];

    if (!previousMotion || !matchingMotion) {
      throw new Error(`Missing motion data for ${color}`);
    }

    // Get start location from previous motion's end (for continuity)
    const startLocation = previousMotion.endLocation;

    // Get hand rotation direction from the matching motion
    const handRotDir = getHandRotationDirection(
      matchingMotion.startLocation as GridLocation,
      matchingMotion.endLocation as GridLocation
    );

    // Get location map for this rotation direction
    const locationMap = getLocationMapForHandRotation(handRotDir);

    // For STATIC motions, end = start (no movement)
    // For other motions, rotate the end location
    const endLocation =
      matchingMotion.motionType === MotionType.STATIC
        ? startLocation
        : locationMap[startLocation as GridLocation];

    // Create rotated-swapped motion
    const rotatedSwappedMotion = {
      ...matchingMotion,
      color, // IMPORTANT: Preserve the color (Blue stays Blue, Red stays Red)
      motionType: matchingMotion.motionType, // Same motion type (from opposite color due to swap)
      startLocation,
      endLocation,
      rotationDirection: matchingMotion.rotationDirection, // Same rotation direction (from opposite color due to swap)
      // Start orientation will be set by OrientationCalculator
      // End orientation will be calculated by OrientationCalculator
    };

    return rotatedSwappedMotion;
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
export const rotatedSwappedLOOPExecutor = new RotatedSwappedLOOPExecutor();
