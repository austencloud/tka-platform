/**
 * Strict Mirrored LOOP Executor
 *
 * Executes the strict mirrored LOOP (Linked Orbital Offset Pattern) by:
 * 1. Taking a partial sequence (always first half - no quartering)
 * 2. Applying vertical mirroring transformations to each beat
 * 3. Generating the remaining steps to complete the circular pattern
 *
 * The mirroring works by:
 * - Flipping positions vertically across the center horizontal axis
 * - Mirroring hand locations (east ↔ west, northeast ↔ northwest, etc.)
 * - Flipping prop rotation directions (clockwise ↔ counter-clockwise)
 * - Maintaining the same letters and motion types
 *
 * IMPORTANT: Slice size is ALWAYS halved (no user choice like ROTATED)
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
  VERTICAL_MIRROR_POSITION_MAP,
  VERTICAL_MIRROR_LOCATION_MAP,
  MIRRORED_LOOP_VALIDATION_SET,
} from "../../domain/constants/strict-loop-position-maps";
import type { SliceSize } from "../../domain/models/circular-models";
import type { StepData } from "../../../../shared/domain/models/StepData";

export class StrictMirroredLOOPExecutor {
  constructor(private OrientationCalculator: IOrientationCalculator) {}

  /**
   * Execute the strict mirrored LOOP
   *
   * @param sequence - The partial sequence to complete (must include start position at index 0)
   * @param sliceSize - Ignored (mirrored LOOP always uses halved)
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

    // Calculate how many steps to generate (always doubles for mirrored)
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
   * Validate that the sequence can perform a mirrored LOOP
   * Requirement: vertical_mirror(start_position) === end_position
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

    // Check if the (start, end) pair is valid for mirroring
    const key = `${startPos},${endPos}`;

    if (!MIRRORED_LOOP_VALIDATION_SET.has(key)) {
      const expectedEnd =
        VERTICAL_MIRROR_POSITION_MAP[startPos as GridPosition];
      throw new Error(
        `Invalid position pair for mirrored LOOP: ${startPos} → ${endPos}. ` +
          `For a mirrored LOOP from ${startPos}, the sequence must end at ${expectedEnd}.`
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

    // Calculate new end position (vertical mirror)
    const newEndPosition = this._getMirroredPosition(previousMatchingStep);

    // Create the new beat with mirrored attributes
    const newStep: StepData = {
      ...previousMatchingStep,
      id: `beat-${stepNumber}`,
      stepNumber,
      startPosition: previousStep.endPosition ?? null,
      endPosition: newEndPosition,
      motions: {
        [MotionColor.BLUE]: this._createMirroredMotion(
          MotionColor.BLUE,
          previousStep,
          previousMatchingStep
        ),
        [MotionColor.RED]: this._createMirroredMotion(
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
   * Get the vertical mirrored position
   */
  private _getMirroredPosition(
    previousMatchingStep: StepData
  ): GridPosition | null {
    const endPos = previousMatchingStep.endPosition;

    if (!endPos) {
      throw new Error("Previous matching beat must have an end position");
    }

    const mirroredPosition =
      VERTICAL_MIRROR_POSITION_MAP[endPos as GridPosition];

    return mirroredPosition;
  }

  /**
   * Create mirrored motion data for the new beat
   * Mirrors locations vertically and flips prop rotation direction
   */
  private _createMirroredMotion(
    color: MotionColor,
    previousStep: StepData,
    previousMatchingStep: StepData
  ): MotionData {
    const previousMotion = previousStep.motions[color];
    const matchingMotion = previousMatchingStep.motions[color];

    if (!previousMotion || !matchingMotion) {
      throw new Error(`Missing motion data for ${color}`);
    }

    // Mirror the end location vertically
    const mirroredEndLocation = this._getMirroredLocation(
      matchingMotion.endLocation as GridLocation
    );

    // Flip the prop rotation direction
    const mirroredPropRotDir = this._getMirroredPropRotDir(
      matchingMotion.rotationDirection
    );

    // Create mirrored motion
    const mirroredMotion = {
      ...matchingMotion,
      startLocation: previousMotion.endLocation,
      endLocation: mirroredEndLocation,
      rotationDirection: mirroredPropRotDir,
      // Start orientation will be set by OrientationCalculator
      // End orientation will be calculated by OrientationCalculator
    };

    return mirroredMotion;
  }

  /**
   * Mirror a location vertically (flip east/west)
   */
  private _getMirroredLocation(location: GridLocation): GridLocation {
    const mirrored = VERTICAL_MIRROR_LOCATION_MAP[location];

    return mirrored;
  }

  /**
   * Mirror prop rotation direction (flip clockwise/counter-clockwise)
   */
  private _getMirroredPropRotDir(
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

export const strictMirroredLOOPExecutor = new StrictMirroredLOOPExecutor(
  orientationCalculator
);
