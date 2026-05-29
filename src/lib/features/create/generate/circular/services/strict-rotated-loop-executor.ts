/**
 * Strict Rotated LOOP Executor
 *
 * Executes the strict rotated LOOP (Linked Orbital Offset Pattern) by:
 * 1. Taking a partial sequence (first half or quarter)
 * 2. Applying rotational transformations to each beat
 * 3. Generating the remaining steps to complete the circular pattern
 *
 * The rotation works by:
 * - Taking each pictograph from the first section
 * - Rotating its hand locations based on the hand's rotation direction
 * - Maintaining the same motion types, turns, and letter patterns
 * - Creating new steps that fit the rotated positions
 */

import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { GridPositionDeriver } from "$lib/shared/pictograph/grid/services/implementations/GridPositionDeriver";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { OrientationCalculator } from "$lib/shared/pictograph/prop/services/implementations/OrientationCalculator";
import {
  HALVED_LOOPS,
  QUARTERED_LOOPS,
  getHandRotationDirection,
  getLocationMapForHandRotation,
} from "../domain/constants/circular-position-maps";
import { Period } from "../domain/models/circular-models";
import type { StepData } from "$lib/shared/foundation/domain/models/StepData";

export class StrictRotatedLOOPExecutor {
  constructor(
    private OrientationCalculator: OrientationCalculator,
    private gridPositionDeriver: GridPositionDeriver
  ) {}

  /**
   * Execute the strict rotated LOOP
   *
   * @param sequence - The partial sequence to complete (must include start position at index 0)
   * @param period - Whether to use halved (180°) or quartered (90°) rotation
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

    // Calculate how many steps to generate
    const sequenceLength = sequence.length;
    const entriesToAdd = this._calculateEntriesToAdd(sequenceLength, period);

    // Generate the new steps
    const generatedSteps: StepData[] = [];
    let lastStep = sequence[sequence.length - 1]!;
    let nextStepNumber = lastStep.stepNumber + 1;

    for (let i = 0; i < entriesToAdd; i++) {
      const finalIntendedLength = sequenceLength + entriesToAdd;
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
   * Validate that the sequence can perform the requested LOOP
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

    // Check if the (start, end) pair is valid for the slice size
    const key = `${startPos},${endPos}`;
    const validationSet =
      period === Period.HALVED ? HALVED_LOOPS : QUARTERED_LOOPS;

    if (!validationSet.has(key)) {
      throw new Error(
        `Invalid position pair for ${period} LOOP: ${startPos} → ${endPos}. ` +
          `This pair cannot complete a ${period} rotation.`
      );
    }
  }

  /**
   * Calculate how many steps need to be added based on slice size
   */
  private _calculateEntriesToAdd(
    sequenceLength: number,
    period: Period
  ): number {
    if (period === Period.HALVED) {
      return sequenceLength; // Double the sequence
    }
    // Period.QUARTERED
    return sequenceLength * 3; // Quadruple the sequence
  }

  /**
   * Create a new LOOP entry by transforming a previous beat
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

    // Calculate new end position
    const newEndPosition = this._calculateNewEndPosition(
      previousMatchingStep,
      previousStep
    );

    // Create the new beat with transformed attributes
    const newStep: StepData = {
      ...previousMatchingStep,
      id: `step-${stepNumber}`,
      stepNumber,
      startPosition: previousStep.endPosition ?? null,
      endPosition: newEndPosition,
      motions: {
        [MotionColor.BLUE]: this._createTransformedMotion(
          MotionColor.BLUE,
          previousStep,
          previousMatchingStep
        ),
        [MotionColor.RED]: this._createTransformedMotion(
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
   * Get the previous matching beat using index mapping
   */
  private _getPreviousMatchingBeat(
    sequence: StepData[],
    stepNumber: number,
    finalLength: number,
    period: Period
  ): StepData {
    const indexMap = this._getIndexMap(period, finalLength);
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
   */
  private _getIndexMap(
    period: Period,
    length: number
  ): Record<number, number> {
    // Handle edge cases for very short sequences
    if (length < 4 && period === Period.QUARTERED) {
      const map: Record<number, number> = {};
      for (let i = 1; i <= length; i++) {
        map[i] = Math.max(i - 1, 1);
      }
      return map;
    }

    if (length < 2 && period === Period.HALVED) {
      const map: Record<number, number> = {};
      for (let i = 1; i <= length; i++) {
        map[i] = Math.max(i - 1, 1);
      }
      return map;
    }

    // Normal index mapping
    const map: Record<number, number> = {};

    if (period === Period.QUARTERED) {
      const quarterLength = Math.floor(length / 4);
      for (let i = quarterLength + 1; i <= length; i++) {
        map[i] = i - quarterLength;
      }
    } else {
      // Period.HALVED
      const halfLength = Math.floor(length / 2);
      for (let i = halfLength + 1; i <= length; i++) {
        map[i] = i - halfLength;
      }
    }

    return map;
  }

  /**
   * Calculate the new end position by rotating locations
   */
  private _calculateNewEndPosition(
    previousMatchingStep: StepData,
    previousStep: StepData
  ): GridPosition | null {
    const blueMotion = previousMatchingStep.motions[MotionColor.BLUE];
    const redMotion = previousMatchingStep.motions[MotionColor.RED];

    if (!blueMotion || !redMotion) {
      throw new Error(
        "Previous matching beat must have both blue and red motions"
      );
    }

    // Get hand rotation directions
    const blueHandRotDir = getHandRotationDirection(
      blueMotion.startLocation as GridLocation,
      blueMotion.endLocation as GridLocation
    );
    const redHandRotDir = getHandRotationDirection(
      redMotion.startLocation as GridLocation,
      redMotion.endLocation as GridLocation
    );

    // Get location maps
    const blueLocationMap = getLocationMapForHandRotation(blueHandRotDir);
    const redLocationMap = getLocationMapForHandRotation(redHandRotDir);

    // Calculate new end locations
    const previousBlueEndLoc =
      previousStep.motions[MotionColor.BLUE]!.endLocation;
    const previousRedEndLoc =
      previousStep.motions[MotionColor.RED]!.endLocation;

    const newBlueEndLoc = blueLocationMap[previousBlueEndLoc as GridLocation];
    const newRedEndLoc = redLocationMap[previousRedEndLoc as GridLocation];

    // Derive GridPosition from (blue, red) location tuple using GridPositionDeriver
    const newPosition = this.gridPositionDeriver.getGridPositionFromLocations(
      newBlueEndLoc,
      newRedEndLoc
    );

    return newPosition;
  }

  /**
   * Create transformed motion data for the new beat
   */
  private _createTransformedMotion(
    color: MotionColor,
    previousStep: StepData,
    previousMatchingStep: StepData
  ): MotionData {
    const previousMotion = previousStep.motions[color];
    const matchingMotion = previousMatchingStep.motions[color];

    if (!previousMotion || !matchingMotion) {
      throw new Error(`Missing motion data for ${color}`);
    }

    // Get hand rotation direction
    const handRotDir = getHandRotationDirection(
      matchingMotion.startLocation as GridLocation,
      matchingMotion.endLocation as GridLocation
    );

    // Get the appropriate location map
    const locationMap = getLocationMapForHandRotation(handRotDir);

    // Calculate rotated end location
    const newEndLocation =
      locationMap[previousMotion.endLocation as GridLocation];

    // Create transformed motion
    return {
      ...matchingMotion,
      startLocation: previousMotion.endLocation,
      endLocation: newEndLocation,
      // Start orientation will be set by OrientationCalculator
      // End orientation will be calculated by OrientationCalculator
    };
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
import { orientationCalculator } from "$lib/shared/pictograph/prop/services/implementations/OrientationCalculator";
import { gridPositionDeriver } from "$lib/shared/pictograph/grid/services/implementations/GridPositionDeriver";

export const strictRotatedLOOPExecutor = new StrictRotatedLOOPExecutor(
  orientationCalculator,
  gridPositionDeriver
);
