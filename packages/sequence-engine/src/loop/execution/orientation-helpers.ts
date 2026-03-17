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
  const blueStartOri = previousStep.blueMotion.endOrientation || "in";
  const redStartOri = previousStep.redMotion.endOrientation || "in";

  const withStart: SequenceStep = {
    ...step,
    blueMotion: {
      ...step.blueMotion,
      startOrientation: blueStartOri,
    },
    redMotion: {
      ...step.redMotion,
      startOrientation: redStartOri,
    },
  };

  // Calculate end orientations
  const blueEndOri = calculateEndOrientation({
    motionType: withStart.blueMotion.motionType,
    turns: withStart.blueMotion.turns,
    rotationDirection: withStart.blueMotion.rotationDirection,
    startLocation: withStart.blueMotion.startLocation,
    endLocation: withStart.blueMotion.endLocation,
    startOrientation: withStart.blueMotion.startOrientation,
  });

  const redEndOri = calculateEndOrientation({
    motionType: withStart.redMotion.motionType,
    turns: withStart.redMotion.turns,
    rotationDirection: withStart.redMotion.rotationDirection,
    startLocation: withStart.redMotion.startLocation,
    endLocation: withStart.redMotion.endLocation,
    startOrientation: withStart.redMotion.startOrientation,
  });

  return {
    ...withStart,
    blueMotion: {
      ...withStart.blueMotion,
      endOrientation: blueEndOri,
    },
    redMotion: {
      ...withStart.redMotion,
      endOrientation: redEndOri,
    },
  };
}
