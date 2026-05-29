/**
 * Orientation Propagation
 *
 * Functions for propagating prop orientations through a sequence.
 * Ensures orientation chain integrity after transforms.
 */

import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { updateSequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type {
  Orientation} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import {
  MotionColor
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { calculateEndOrientation } from "$lib/shared/pictograph/prop/services/orientation-calculator";

/**
 * Propagate orientations for a single color through all steps.
 * Each beat's start orientation = previous beat's end orientation.
 */
export function propagateOrientationsForColor(
  steps: StepData[],
  color: MotionColor,
  initialOrientation: Orientation
): StepData[] {
  const updatedSteps = [...steps];
  let previousEndOrientation: Orientation = initialOrientation;

  for (let i = 0; i < updatedSteps.length; i++) {
    const beat = updatedSteps[i];
    if (!beat?.motions) continue;

    const motion = beat.motions[color];
    if (!motion) continue;

    // Calculate new end orientation based on this beat's motion
    const tempMotionData = createMotionData({
      ...motion,
      startOrientation: previousEndOrientation,
    });

    const newEndOrientation = calculateEndOrientation(
      tempMotionData,
      color
    );

    // Update this beat with correct orientations
    updatedSteps[i] = {
      ...beat,
      motions: {
        ...beat.motions,
        [color]: {
          ...motion,
          startOrientation: previousEndOrientation,
          endOrientation: newEndOrientation,
        },
      },
    };

    previousEndOrientation = newEndOrientation;
  }

  return updatedSteps;
}

/**
 * Recalculate all prop orientations through the entire sequence.
 * Uses the start position orientations as the baseline.
 */
export function recalculateAllOrientations(
  sequence: SequenceData
): SequenceData {
  if (sequence.steps.length === 0 || !sequence.startPosition) {
    return sequence;
  }

  const startPosition = sequence.startPosition;
  let updatedSteps = [...sequence.steps];
  const blueStartMotion = startPosition.motions[MotionColor.BLUE];
  const redStartMotion = startPosition.motions[MotionColor.RED];

  // Recalculate orientations for blue prop
  if (blueStartMotion) {
    const blueStartOrientation = blueStartMotion.endOrientation;
    updatedSteps = propagateOrientationsForColor(
      updatedSteps,
      MotionColor.BLUE,
      blueStartOrientation
    );
  }

  // Recalculate orientations for red prop
  if (redStartMotion) {
    const redStartOrientation = redStartMotion.endOrientation;
    updatedSteps = propagateOrientationsForColor(
      updatedSteps,
      MotionColor.RED,
      redStartOrientation
    );
  }

  return updateSequenceData(sequence, { steps: updatedSteps });
}
