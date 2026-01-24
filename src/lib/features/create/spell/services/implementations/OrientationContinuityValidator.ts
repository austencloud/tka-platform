/**
 * Orientation Continuity Validator Implementation
 *
 * Validates beat-to-beat orientation continuity in sequences.
 * Each beat's start orientation must match the previous beat's end orientation.
 */

import type {
  IOrientationContinuityValidator,
  OrientationContinuityError,
  TransitionValidationResult,
} from "../contracts/IOrientationContinuityValidator";
import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { IOrientationCalculator } from "$lib/shared/pictograph/prop/services/contracts/IOrientationCalculator";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

export class OrientationContinuityValidator
  implements IOrientationContinuityValidator
{
  validateSequence(sequence: SequenceData): OrientationContinuityError[] {
    const errors: OrientationContinuityError[] = [];

    if (sequence.steps.length === 0) {
      return errors;
    }

    // Check each beat against the previous one
    for (let i = 0; i < sequence.steps.length; i++) {
      const currentBeat = sequence.steps[i];
      if (!currentBeat) continue;

      // Get the previous beat (or start position for first beat)
      const previousBeat =
        i === 0
          ? sequence.startPosition
          : sequence.steps[i - 1];

      if (!previousBeat) continue;

      // Validate blue prop orientation continuity
      const blueError = this.validateColorContinuity(
        currentBeat,
        previousBeat,
        MotionColor.BLUE,
        i
      );
      if (blueError) {
        errors.push(blueError);
      }

      // Validate red prop orientation continuity
      const redError = this.validateColorContinuity(
        currentBeat,
        previousBeat,
        MotionColor.RED,
        i
      );
      if (redError) {
        errors.push(redError);
      }
    }

    return errors;
  }

  validateTransition(
    lastBeat: StepData,
    nextPictograph: PictographData,
    orientationCalculator: IOrientationCalculator
  ): TransitionValidationResult {
    const errors: OrientationContinuityError[] = [];

    // Check blue prop orientation
    const blueMotion = nextPictograph.motions[MotionColor.BLUE];
    const lastBlueMotion = lastBeat.motions[MotionColor.BLUE];
    if (blueMotion && lastBlueMotion) {
      const expectedStartOrientation = lastBlueMotion.endOrientation;
      const actualStartOrientation = blueMotion.startOrientation;

      if (expectedStartOrientation !== actualStartOrientation) {
        errors.push({
          stepIndex: lastBeat.stepNumber,
          color: MotionColor.BLUE,
          expectedStartOrientation: expectedStartOrientation || "unknown",
          actualStartOrientation: actualStartOrientation || "unknown",
          message: `Blue prop orientation break: expected ${expectedStartOrientation} but got ${actualStartOrientation}`,
        });
      }
    }

    // Check red prop orientation
    const redMotion = nextPictograph.motions[MotionColor.RED];
    const lastRedMotion = lastBeat.motions[MotionColor.RED];
    if (redMotion && lastRedMotion) {
      const expectedStartOrientation = lastRedMotion.endOrientation;
      const actualStartOrientation = redMotion.startOrientation;

      if (expectedStartOrientation !== actualStartOrientation) {
        errors.push({
          stepIndex: lastBeat.stepNumber,
          color: MotionColor.RED,
          expectedStartOrientation: expectedStartOrientation || "unknown",
          actualStartOrientation: actualStartOrientation || "unknown",
          message: `Red prop orientation break: expected ${expectedStartOrientation} but got ${actualStartOrientation}`,
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Helper: Validate orientation continuity for a single color
   */
  private validateColorContinuity(
    currentBeat: StepData | PictographData,
    previousBeat: StepData | PictographData,
    color: MotionColor,
    stepIndex: number
  ): OrientationContinuityError | null {
    const currentMotion = currentBeat.motions[color];
    const previousMotion = previousBeat.motions[color];

    if (!currentMotion || !previousMotion) {
      return null; // Skip if either beat doesn't have this color
    }

    const expectedStartOrientation = previousMotion.endOrientation;
    const actualStartOrientation = currentMotion.startOrientation;

    if (expectedStartOrientation !== actualStartOrientation) {
      return {
        stepIndex,
        color,
        expectedStartOrientation: expectedStartOrientation || "unknown",
        actualStartOrientation: actualStartOrientation || "unknown",
        message: `${color === MotionColor.BLUE ? "Blue" : "Red"} prop orientation break at step ${stepIndex + 1}: expected ${expectedStartOrientation} but got ${actualStartOrientation}`,
      };
    }

    return null;
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
export const orientationContinuityValidator = new OrientationContinuityValidator();
