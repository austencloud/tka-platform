/**
 * Orientation Helpers for LOOP Executors
 *
 * Provides updateStartOrientations and updateEndOrientations functionality
 * that the app's executors get from IOrientationCalculator.
 * Wraps the engine's calculateEndOrientation for the executor use case.
 */

import { calculateEndOrientation } from "../../core/orientation/OrientationCalculator.js";
import type { SequenceStep } from "../../core/types/sequence-engine-types.js";

/**
 * then calculate the next step's end orientations.
 *
 * Equivalent to calling:
 *   OrientationCalculator.updateStartOrientations(nextStep, previousStep)
 *   OrientationCalculator.updateEndOrientations(nextStep)
 */
export function updateStepOrientations(
  step: SequenceStep,
  previousStep: SequenceStep
): SequenceStep {
  // Set start orientations from previous step's end orientations
  const leftStartOri = previousStep.motions.left.endOrientation || "in";
  const rightStartOri = previousStep.motions.right.endOrientation || "in";

  const withStart: SequenceStep = {
    ...step,
    motions: {
      left: {
      ...step.motions.left,
      startOrientation: leftStartOri,
    },
      right: {
      ...step.motions.right,
      startOrientation: rightStartOri,
    },
    },
  };

  // Calculate end orientations
  const leftEndOri = calculateEndOrientation({
    motionType: withStart.motions.left.motionType,
    turns: withStart.motions.left.turns,
    rotationDirection: withStart.motions.left.rotationDirection,
    startLocation: withStart.motions.left.startLocation,
    endLocation: withStart.motions.left.endLocation,
    startOrientation: withStart.motions.left.startOrientation,
  });

  const rightEndOri = calculateEndOrientation({
    motionType: withStart.motions.right.motionType,
    turns: withStart.motions.right.turns,
    rotationDirection: withStart.motions.right.rotationDirection,
    startLocation: withStart.motions.right.startLocation,
    endLocation: withStart.motions.right.endLocation,
    startOrientation: withStart.motions.right.startOrientation,
  });

  return {
    ...withStart,
    motions: {
      left: {
      ...withStart.motions.left,
      endOrientation: leftEndOri,
    },
      right: {
      ...withStart.motions.right,
      endOrientation: rightEndOri,
    },
    },
  };
}
