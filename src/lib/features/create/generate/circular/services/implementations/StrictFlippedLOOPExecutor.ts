/**
 * Strict Flipped LOOP Executor
 *
 * Executes the strict flipped LOOP (Linked Orbital Offset Pattern) by:
 * 1. Taking a partial sequence (always first half - no quartering)
 * 2. Applying a vertical flip (N ↔ S) to each beat
 * 3. Generating the remaining steps to complete the circular pattern
 *
 * The flip works by:
 * - Flipping positions vertically (north ↔ south, northeast ↔ southeast, etc.)
 * - Flipping hand locations (N ↔ S, NE ↔ SE, NW ↔ SW)
 * - Flipping prop rotation directions (clockwise ↔ counter-clockwise)
 * - Maintaining the same letters and motion types
 *
 * IMPORTANT: Slice size is ALWAYS halved (no quartering support)
 */

import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import {
  RotationDirection,
  MotionColor,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type {
  GridPosition,
  GridLocation,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { IOrientationCalculator } from "$lib/shared/pictograph/prop/services/contracts/IOrientationCalculator";
import {
  HORIZONTAL_MIRROR_POSITION_MAP,
  HORIZONTAL_MIRROR_LOCATION_MAP,
  FLIPPED_LOOP_VALIDATION_SET,
} from "../../domain/constants/strict-loop-position-maps";
import type { SliceSize } from "../../domain/models/circular-models";
import type { StepData } from "../../../../shared/domain/models/StepData";

export class StrictFlippedLOOPExecutor {
  constructor(private OrientationCalculator: IOrientationCalculator) {}

  /**
   * Execute the strict flipped LOOP
   *
   * @param sequence - The partial sequence to complete (must include start position at index 0)
   * @param _sliceSize - Ignored (flipped LOOP always uses halved)
   * @returns The complete circular sequence with all steps
   */
  executeLOOP(sequence: StepData[], _sliceSize: SliceSize): StepData[] {
    this._validateSequence(sequence);

    // Remove start position (index 0) for processing
    const startPosition = sequence.shift();
    if (!startPosition) {
      throw new Error("Sequence must have a start position");
    }

    // Calculate how many steps to generate (always doubles for flipped)
    const sequenceLength = sequence.length;
    const entriesToAdd = sequenceLength;

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
   * Validate that the sequence can perform a flipped LOOP
   * Requirement: horizontal_mirror(start_position) === end_position
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

    const key = `${startPos},${endPos}`;

    if (!FLIPPED_LOOP_VALIDATION_SET.has(key)) {
      const expectedEnd =
        HORIZONTAL_MIRROR_POSITION_MAP[startPos as GridPosition];
      throw new Error(
        `Invalid position pair for flipped LOOP: ${startPos} → ${endPos}. ` +
          `For a flipped LOOP from ${startPos}, the sequence must end at ${expectedEnd}.`
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
    const previousMatchingStep = this._getPreviousMatchingBeat(
      sequence,
      stepNumber,
      finalIntendedLength
    );

    const newEndPosition = this._getFlippedPosition(previousMatchingStep);

    const newStep: StepData = {
      ...previousMatchingStep,
      id: `beat-${stepNumber}`,
      stepNumber,
      startPosition: previousStep.endPosition ?? null,
      endPosition: newEndPosition,
      motions: {
        [MotionColor.BLUE]: this._createFlippedMotion(
          MotionColor.BLUE,
          previousStep,
          previousMatchingStep
        ),
        [MotionColor.RED]: this._createFlippedMotion(
          MotionColor.RED,
          previousStep,
          previousMatchingStep
        ),
      },
    };

    const stepWithStartOri =
      this.OrientationCalculator.updateStartOrientations(newStep, previousStep);
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

    for (let i = halfLength + 1; i <= length; i++) {
      map[i] = i - halfLength;
    }

    return map;
  }

  /**
   * Get the flipped position (N ↔ S)
   */
  private _getFlippedPosition(
    previousMatchingStep: StepData
  ): GridPosition | null {
    const endPos = previousMatchingStep.endPosition;

    if (!endPos) {
      throw new Error("Previous matching beat must have an end position");
    }

    return HORIZONTAL_MIRROR_POSITION_MAP[endPos as GridPosition];
  }

  /**
   * Create flipped motion data for the new beat
   * Flips locations vertically (N ↔ S) and flips prop rotation direction
   */
  private _createFlippedMotion(
    color: MotionColor,
    previousStep: StepData,
    previousMatchingStep: StepData
  ): MotionData {
    const previousMotion = previousStep.motions[color];
    const matchingMotion = previousMatchingStep.motions[color];

    if (!previousMotion || !matchingMotion) {
      throw new Error(`Missing motion data for ${color}`);
    }

    const flippedEndLocation = this._getFlippedLocation(
      matchingMotion.endLocation as GridLocation
    );

    const flippedPropRotDir = this._getFlippedPropRotDir(
      matchingMotion.rotationDirection
    );

    const flippedMotion = {
      ...matchingMotion,
      startLocation: previousMotion.endLocation,
      endLocation: flippedEndLocation,
      rotationDirection: flippedPropRotDir,
    };

    return flippedMotion;
  }

  /**
   * Flip a location vertically (N ↔ S)
   */
  private _getFlippedLocation(location: GridLocation): GridLocation {
    return HORIZONTAL_MIRROR_LOCATION_MAP[location];
  }

  /**
   * Flip prop rotation direction (CW ↔ CCW)
   */
  private _getFlippedPropRotDir(
    propRotDir: RotationDirection
  ): RotationDirection {
    if (propRotDir === RotationDirection.CLOCKWISE) {
      return RotationDirection.COUNTER_CLOCKWISE;
    } else if (propRotDir === RotationDirection.COUNTER_CLOCKWISE) {
      return RotationDirection.CLOCKWISE;
    }

    return propRotDir;
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
import { orientationCalculator } from "$lib/shared/pictograph/prop/services/implementations/OrientationCalculator";

export const strictFlippedLOOPExecutor = new StrictFlippedLOOPExecutor(
  orientationCalculator
);
