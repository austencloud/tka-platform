/**
 * Orientation Continuity Validator
 *
 * Validates beat-to-beat orientation continuity in sequences.
 * Each beat's start orientation must match the previous beat's end orientation.
 */

import type { OrientationContinuityError, TransitionValidationResult } from "./types";

/**
 * Interface describing the shape of the orientation continuity validator module.
 * Consumers that previously held a class instance can use this type.
 */
export interface OrientationContinuityValidator {
  validateSequence: (sequence: SequenceData) => OrientationContinuityError[];
  validateTransition: (
    lastStep: StepData,
    nextPictograph: PictographData,
    orientationCalculator: OrientationCalculatorDep
  ) => TransitionValidationResult;
}
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { isVisibleMotion } from "$lib/shared/pictograph/shared/domain/models/motion-data";

/**
 * Structural type for the orientation calculator dependency.
 * The validateTransition param is accepted for signature compatibility but unused.
 */
type OrientationCalculatorDep = {
  calculateEndOrientation: (...args: never[]) => unknown;
};

export function validateSequence(sequence: SequenceData): OrientationContinuityError[] {
  const errors: OrientationContinuityError[] = [];

  if (sequence.steps.length === 0) {
    return errors;
  }

  // Check each beat against the previous one
  for (let i = 0; i < sequence.steps.length; i++) {
    const currentStep = sequence.steps[i];
    if (!currentStep) continue;

    // Get the previous beat (or start position for first beat)
    const previousBeat =
      i === 0
        ? sequence.startPosition
        : sequence.steps[i - 1];

    if (!previousBeat) continue;

    // Validate blue prop orientation continuity
    const blueError = validateColorContinuity(
      currentStep,
      previousBeat,
      MotionColor.BLUE,
      i
    );
    if (blueError) {
      errors.push(blueError);
    }

    // Validate red prop orientation continuity
    const redError = validateColorContinuity(
      currentStep,
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

export function validateTransition(
  lastStep: StepData,
  nextPictograph: PictographData,
  _orientationCalculator: OrientationCalculatorDep
): TransitionValidationResult {
  const errors: OrientationContinuityError[] = [];

  // Check blue prop orientation
  const blueMotion = nextPictograph.motions[MotionColor.BLUE];
  const lastBlueMotion = lastStep.motions[MotionColor.BLUE];
  // Invisible placeholder = hand not really there (both-required Step shape):
  // vacuously valid, exactly like the old absent-hand skip.
  if (isVisibleMotion(blueMotion) && isVisibleMotion(lastBlueMotion)) {
    const expectedStartOrientation = lastBlueMotion.endOrientation;
    const actualStartOrientation = blueMotion.startOrientation;

    if (expectedStartOrientation !== actualStartOrientation) {
      errors.push({
        stepIndex: lastStep.stepNumber,
        color: MotionColor.BLUE,
        expectedStartOrientation: expectedStartOrientation || "unknown",
        actualStartOrientation: actualStartOrientation || "unknown",
        message: `Blue prop orientation break: expected ${expectedStartOrientation} but got ${actualStartOrientation}`,
      });
    }
  }

  // Check red prop orientation
  const redMotion = nextPictograph.motions[MotionColor.RED];
  const lastRedMotion = lastStep.motions[MotionColor.RED];
  if (isVisibleMotion(redMotion) && isVisibleMotion(lastRedMotion)) {
    const expectedStartOrientation = lastRedMotion.endOrientation;
    const actualStartOrientation = redMotion.startOrientation;

    if (expectedStartOrientation !== actualStartOrientation) {
      errors.push({
        stepIndex: lastStep.stepNumber,
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

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

/**
 * Helper: Validate orientation continuity for a single color
 */
function validateColorContinuity(
  currentStep: StepData | PictographData,
  previousBeat: StepData | PictographData,
  color: MotionColor,
  stepIndex: number
): OrientationContinuityError | null {
  const currentMotion = currentStep.motions[color];
  const previousMotion = previousBeat.motions[color];

  if (!isVisibleMotion(currentMotion) || !isVisibleMotion(previousMotion)) {
    return null; // Skip if either beat doesn't really have this color
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
