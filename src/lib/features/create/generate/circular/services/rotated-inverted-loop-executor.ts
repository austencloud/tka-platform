/**
 * Rotated Inverted LOOP Executor
 *
 * Executes the rotated-inverted LOOP (Linked Orbital Offset Pattern) by combining:
 * 1. ROTATED: Rotate locations based on handpath direction (90°, 180°, or 270°)
 * 2. INVERTED: Flip letters (A↔B), flip motion types (PRO↔ANTI), flip prop rotation (CW↔CCW)
 *
 * This creates a sequence where:
 * - Letters are flipped (inverted effect)
 * - Motion types are flipped (PRO ↔ ANTI) (inverted effect)
 * - Prop rotation directions are flipped (CW ↔ CCW) (inverted effect)
 * - Locations are rotated based on the handpath direction
 * - **Colors are NOT swapped** (Blue stays Blue, Red stays Red)
 *
 * IMPORTANT: Supports both quartered and halved slice sizes
 * IMPORTANT: End position is calculated from rotated locations
 */

import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import type { Letter } from "$lib/shared/foundation/domain/models/letter";
import { getGridPositionFromLocations } from "$lib/shared/pictograph/grid/services/grid-position-deriver";
import {
  MotionType,
  MotionColor,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type {
  GridLocation,
  GridPosition,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { RotationDirection } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import {
  updateStartOrientations,
  updateEndOrientations,
} from "$lib/shared/pictograph/prop/services/orientation-calculator";
import type { LOOPParameterProvider } from "$lib/features/create/generate/shared/services/loop-parameter-provider";
import {
  getHandRotationDirection,
  getLocationMapForHandRotation,
  HALVED_LOOPS,
  QUARTERED_LOOPS,
} from "../domain/constants/circular-position-maps";
import { Period } from "../domain/models/circular-models";

export class RotatedInvertedLOOPExecutor {
  constructor(
    private loopParams: LOOPParameterProvider
  ) {}

  /**
   * Execute the rotated-inverted LOOP
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

    // Generate LOOP steps
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
   * Validate that the sequence can perform a rotated-inverted LOOP
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

    // Check if the (start, end) pair is valid for the requested slice size
    const key = `${startPos},${endPos}`;
    const validationSet =
      period === Period.QUARTERED ? QUARTERED_LOOPS : HALVED_LOOPS;

    if (!validationSet.has(key)) {
      throw new Error(
        `Invalid position pair for rotated-inverted ${period} LOOP: ${startPos} → ${endPos}. ` +
          `The end position must match the ${period} rotation requirement.`
      );
    }
  }

  /**
   * Create a new LOOP entry by transforming a previous beat with ROTATION + INVERTED
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

    // Get the inverted letter (INVERTED effect)
    if (!previousMatchingStep.letter) {
      throw new Error("Previous matching beat must have a letter");
    }
    if (!this.loopParams) {
      throw new Error(
        "LOOPParameterProvider is null - likely a module initialization order issue. " +
        "Check that loopParameterProvider is imported before RotatedInvertedLOOPExecutor singleton."
      );
    }
    const invertedLetter = this.loopParams.getInvertedLetter(
      previousMatchingStep.letter as string
    ) as Letter;

    // Calculate the rotated end position
    const rotatedEndPosition = this._getRotatedEndPosition(
      previousStep,
      previousMatchingStep
    );

    // Create the new beat with rotated and inverted attributes
    // KEY: No color swapping - Blue stays Blue, Red stays Red
    //      Motion types are flipped (PRO ↔ ANTI)
    //      Prop rotations are flipped (CW ↔ CCW)
    //      Locations are rotated based on handpath direction
    const newStep: StepData = {
      ...previousMatchingStep,
      id: `step-${stepNumber}`,
      stepNumber,
      letter: invertedLetter, // INVERTED: Flip letter
      startPosition: previousStep.endPosition ?? null,
      endPosition: rotatedEndPosition,
      motions: {
        [MotionColor.BLUE]: this._createRotatedInvertedMotion(
          MotionColor.BLUE,
          previousStep,
          previousMatchingStep
        ),
        [MotionColor.RED]: this._createRotatedInvertedMotion(
          MotionColor.RED,
          previousStep,
          previousMatchingStep
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
    // Get hand rotation directions from the matching beat (same color)
    const blueHandRotDir = getHandRotationDirection(
      previousMatchingStep.motions[MotionColor.BLUE]!
        .startLocation as GridLocation,
      previousMatchingStep.motions[MotionColor.BLUE]!
        .endLocation as GridLocation
    );
    const redHandRotDir = getHandRotationDirection(
      previousMatchingStep.motions[MotionColor.RED]!
        .startLocation as GridLocation,
      previousMatchingStep.motions[MotionColor.RED]!.endLocation as GridLocation
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
   * Create rotated-inverted motion data for the new beat
   * Combines location rotation with motion type and prop rotation flipping
   */
  private _createRotatedInvertedMotion(
    color: MotionColor,
    previousStep: StepData,
    previousMatchingStep: StepData
  ): MotionData {
    const previousMotion = previousStep.motions[color];
    const matchingMotion = previousMatchingStep.motions[color]; // Same color (no swap)

    if (!previousMotion || !matchingMotion) {
      throw new Error(`Missing motion data for ${color}`);
    }

    // Get hand rotation direction from the matching motion
    const handRotDir = getHandRotationDirection(
      matchingMotion.startLocation as GridLocation,
      matchingMotion.endLocation as GridLocation
    );

    // Get location map for this rotation direction
    const locationMap = getLocationMapForHandRotation(handRotDir);

    // Rotate the end location (ROTATED effect)
    const rotatedEndLocation =
      locationMap[previousMotion.endLocation as GridLocation];

    // Flip the motion type (INVERTED effect)
    const invertedMotionType = this._getInvertedMotionType(
      matchingMotion.motionType
    );

    // Flip the prop rotation direction (INVERTED effect)
    const invertedPropRotDir = this._getInvertedPropRotDir(
      matchingMotion.rotationDirection
    );

    // Create rotated-inverted motion
    const rotatedInvertedMotion = {
      ...matchingMotion,
      color, // Preserve the color (no swap)
      motionType: invertedMotionType, // INVERTED: Flip motion type
      startLocation: previousMotion.endLocation,
      endLocation: rotatedEndLocation, // ROTATED: Rotate location
      rotationDirection: invertedPropRotDir, // INVERTED: Flip prop rotation
      // Start orientation will be set by OrientationCalculator
      // End orientation will be calculated by OrientationCalculator
    };

    return rotatedInvertedMotion;
  }

  /**
   * Get the inverted motion type (flip PRO ↔ ANTI)
   * STATIC and DASH stay the same
   */
  private _getInvertedMotionType(motionType: MotionType): MotionType {
    if (motionType === MotionType.PRO) {
      return MotionType.ANTI;
    } else if (motionType === MotionType.ANTI) {
      return MotionType.PRO;
    }

    // STATIC and DASH stay the same
    return motionType;
  }

  /**
   * Get the inverted prop rotation direction (flip CW ↔ CCW)
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
import { loopParameterProvider } from "$lib/features/create/generate/shared/services/loop-parameter-provider";

export const rotatedInvertedLOOPExecutor = new RotatedInvertedLOOPExecutor(
  loopParameterProvider
);
