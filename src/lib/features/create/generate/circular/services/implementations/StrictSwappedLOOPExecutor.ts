/**
 * Strict Swapped LOOP Executor
 *
 * Executes the strict swapped LOOP (Linked Orbital Offset Pattern) by:
 * 1. Taking a partial sequence (always first half - no quartering)
 * 2. Swapping blue and red attributes between steps
 * 3. Generating the remaining steps to complete the circular pattern
 *
 * The swapping works by:
 * - Swapping blue ↔ red motion attributes entirely
 * - Transforming positions according to the swap map
 * - Maintaining the same letters, motion types, and prop rotation directions
 * - Only the color assignment changes
 *
 * IMPORTANT: Slice size is ALWAYS halved (no user choice like ROTATED)
 */

import {
  MotionColor,
  MotionType,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { IGridPositionDeriver } from "$lib/shared/pictograph/grid/services/contracts/IGridPositionDeriver";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { IOrientationCalculator } from "$lib/shared/pictograph/prop/services/contracts/IOrientationCalculator";
import {
  SWAPPED_POSITION_MAP,
  SWAPPED_LOOP_VALIDATION_SET,
} from "../../domain/constants/strict-loop-position-maps";
import type { SliceSize } from "../../domain/models/circular-models";
import type { StepData } from "../../../../shared/domain/models/StepData";

export class StrictSwappedLOOPExecutor {
  constructor(
    private OrientationCalculator: IOrientationCalculator,
    private gridPositionDeriver: IGridPositionDeriver
  ) {}

  /**
   * Execute the strict swapped LOOP
   *
   * @param sequence - The partial sequence to complete (must include start position at index 0)
   * @param sliceSize - Ignored (swapped LOOP always uses halved)
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

    // Calculate how many steps to generate (always doubles for swapped)
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
   * Validate that the sequence can perform a swapped LOOP
   * Requirement: swapped_position(start_position) === end_position
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

    // Check if the (start, end) pair is valid for swapping
    const key = `${startPos},${endPos}`;

    if (!SWAPPED_LOOP_VALIDATION_SET.has(key)) {
      const expectedEnd = SWAPPED_POSITION_MAP[startPos as GridPosition];
      throw new Error(
        `Invalid position pair for swapped LOOP: ${startPos} → ${endPos}. ` +
          `For a swapped LOOP from ${startPos}, the sequence must end at ${expectedEnd}.`
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

    // Create the swapped motions first
    const matchingBlueMotion = previousMatchingStep.motions[MotionColor.RED];
    const matchingRedMotion = previousMatchingStep.motions[MotionColor.BLUE];

    if (!matchingBlueMotion || !matchingRedMotion) {
      throw new Error("Matching beat is missing required motion data");
    }

    const blueMotion = this._createSwappedMotion(
      MotionColor.BLUE,
      previousStep,
      matchingBlueMotion // Use RED from matching beat
    );
    const redMotion = this._createSwappedMotion(
      MotionColor.RED,
      previousStep,
      matchingRedMotion // Use BLUE from matching beat
    );

    // CRITICAL: Recalculate the actual grid positions from the hand locations
    // The swapped map is just a validation - we need to derive positions from actual hand locations
    const actualStartPosition =
      this.gridPositionDeriver.getGridPositionFromLocations(
        blueMotion.startLocation,
        redMotion.startLocation
      );
    const actualEndPosition =
      this.gridPositionDeriver.getGridPositionFromLocations(
        blueMotion.endLocation,
        redMotion.endLocation
      );

    // Create the new beat with swapped attributes (BLUE ↔ RED)
    // Note: We swap the color assignments - blue gets red's data and vice versa
    const newStep: StepData = {
      ...previousMatchingStep,
      id: `beat-${stepNumber}`,
      stepNumber,
      startPosition: actualStartPosition,
      endPosition: actualEndPosition,
      motions: {
        [MotionColor.BLUE]: blueMotion,
        [MotionColor.RED]: redMotion,
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
   * Create swapped motion data for the new beat
   * Uses the opposite color's matching motion attributes
   */
  private _createSwappedMotion(
    color: MotionColor,
    previousStep: StepData,
    matchingMotion: MotionData // This is from the OPPOSITE color in the matching beat
  ): MotionData {
    // For CONTINUITY: Always use same color from previous beat
    // (Blue continues from where Blue ended, Red continues from where Red ended)
    // The swap affects which PATTERN to follow, not where to continue from
    const previousMotion = previousStep.motions[color];

    if (!previousMotion) {
      throw new Error(`Missing motion data for ${color}`);
    }

    // Get start location from previous motion's end (for continuity)
    const startLocation = previousMotion.endLocation;

    // For STATIC motions, end = start (no movement)
    // For other motions, keep the matching motion's end location
    const endLocation =
      matchingMotion.motionType === MotionType.STATIC
        ? startLocation
        : matchingMotion.endLocation;

    // CRITICAL: We must explicitly set the color to match THIS motion,
    // not copy it from the opposite color's matching motion!
    // We want Blue to DO what Red did, but still BE Blue.
    const swappedMotion = {
      ...matchingMotion,
      color, // FIXED: Set to THIS motion's color, not matchingMotion's color
      startLocation,
      endLocation,
      // motionType, rotationDirection, turns all come from matchingMotion (opposite color)
      // Start orientation will be set by OrientationCalculator
      // End orientation will be calculated by OrientationCalculator
    };

    return swappedMotion;
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
import { orientationCalculator } from "$lib/shared/pictograph/prop/services/implementations/OrientationCalculator";
import { gridPositionDeriver } from "$lib/shared/pictograph/grid/services/implementations/GridPositionDeriver";

export const strictSwappedLOOPExecutor = new StrictSwappedLOOPExecutor(
  orientationCalculator,
  gridPositionDeriver
);
