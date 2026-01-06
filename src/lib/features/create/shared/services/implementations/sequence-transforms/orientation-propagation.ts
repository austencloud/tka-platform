/**
 * Orientation Propagation
 *
 * Functions for propagating prop orientations through a sequence.
 * Ensures orientation chain integrity after transforms.
 */

import type { BeatData } from "../../../domain/models/BeatData";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { updateSequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type {
  Orientation} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import {
  MotionColor
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { IOrientationCalculator } from "$lib/shared/pictograph/prop/services/contracts/IOrientationCalculator";

/**
 * Propagate orientations for a single color through all beats.
 * Each beat's start orientation = previous beat's end orientation.
 */
export function propagateOrientationsForColor(
  beats: BeatData[],
  color: MotionColor,
  initialOrientation: Orientation,
  orientationCalculator: IOrientationCalculator
): BeatData[] {
  const updatedBeats = [...beats];
  let previousEndOrientation: Orientation = initialOrientation;

  for (let i = 0; i < updatedBeats.length; i++) {
    const beat = updatedBeats[i];
    if (!beat?.motions) continue;

    const motion = beat.motions[color];
    if (!motion) continue;

    // Calculate new end orientation based on this beat's motion
    const tempMotionData = createMotionData({
      ...motion,
      startOrientation: previousEndOrientation,
    });

    const newEndOrientation = orientationCalculator.calculateEndOrientation(
      tempMotionData,
      color
    );

    // Update this beat with correct orientations
    updatedBeats[i] = {
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

  return updatedBeats;
}

/**
 * Recalculate all prop orientations through the entire sequence.
 * Uses the start position orientations as the baseline.
 */
export function recalculateAllOrientations(
  sequence: SequenceData,
  orientationCalculator: IOrientationCalculator
): SequenceData {
  if (sequence.beats.length === 0 || !sequence.startPosition) {
    return sequence;
  }

  const startPosition = sequence.startPosition;
  let updatedBeats = [...sequence.beats];

  // Recalculate orientations for blue prop
  if (startPosition.motions[MotionColor.BLUE]) {
    const blueStartOrientation =
      startPosition.motions[MotionColor.BLUE].endOrientation;
    updatedBeats = propagateOrientationsForColor(
      updatedBeats,
      MotionColor.BLUE,
      blueStartOrientation,
      orientationCalculator
    );
  }

  // Recalculate orientations for red prop
  if (startPosition.motions[MotionColor.RED]) {
    const redStartOrientation =
      startPosition.motions[MotionColor.RED].endOrientation;
    updatedBeats = propagateOrientationsForColor(
      updatedBeats,
      MotionColor.RED,
      redStartOrientation,
      orientationCalculator
    );
  }

  return updateSequenceData(sequence, { beats: updatedBeats });
}
