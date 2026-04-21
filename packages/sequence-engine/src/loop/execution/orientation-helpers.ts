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
 * Propagate end orientations from the previous step to the next step's start orientations,
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
  const blueStartOri = previousStep.motions.blue.endOrientation || "in";
  const redStartOri = previousStep.motions.red.endOrientation || "in";

  const withStart: SequenceStep = {
    ...step,
    motions: {
      blue: {
      ...step.motions.blue,
      startOrientation: blueStartOri,
    },
      red: {
      ...step.motions.red,
      startOrientation: redStartOri,
    },
    },
  };

  // Calculate end orientations
  const blueEndOri = calculateEndOrientation({
    motionType: withStart.motions.blue.motionType,
    turns: withStart.motions.blue.turns,
    rotationDirection: withStart.motions.blue.rotationDirection,
    startLocation: withStart.motions.blue.startLocation,
    endLocation: withStart.motions.blue.endLocation,
    startOrientation: withStart.motions.blue.startOrientation,
  });

  const redEndOri = calculateEndOrientation({
    motionType: withStart.motions.red.motionType,
    turns: withStart.motions.red.turns,
    rotationDirection: withStart.motions.red.rotationDirection,
    startLocation: withStart.motions.red.startLocation,
    endLocation: withStart.motions.red.endLocation,
    startOrientation: withStart.motions.red.startOrientation,
  });

  return {
    ...withStart,
    motions: {
      blue: {
      ...withStart.motions.blue,
      endOrientation: blueEndOri,
    },
      red: {
      ...withStart.motions.red,
      endOrientation: redEndOri,
    },
    },
  };
}
