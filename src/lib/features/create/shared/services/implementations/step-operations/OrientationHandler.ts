/**
 * Orientation Handler
 * Handles beat orientation updates and propagation through the sequence.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { BeatData } from "../../../domain/models/BeatData";
import type { StartPositionData } from "../../../domain/models/StartPositionData";
import { createStartPositionData } from "../../../domain/factories/createStartPositionData";
import type { ICreateModuleState } from "../../../types/create-module-types";
import type { IOrientationCalculator } from "$lib/shared/pictograph/prop/services/contracts/IOrientationCalculator";
import {
  createMotionData,
  type MotionData,
} from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { container } from "$lib/shared/di";
import { createComponentLogger } from "$lib/shared/utils/debug-logger";
import {
  getBeatDataFromState,
  START_POSITION_BEAT_NUMBER,
} from "./beat-data-helpers";

const logger = createComponentLogger("OrientationHandler");

/**
 * Update orientation for a specific prop color in a beat
 */
export function updateBeatOrientation(
  beatNumber: number,
  color: string,
  orientation: string,
  createModuleState: ICreateModuleState
): void {
  const beatData = getBeatDataFromState(beatNumber, createModuleState);

  if (!beatData?.motions) {
    logger.warn("Cannot update orientation - no beat data available");
    return;
  }

  const colorKey = color as MotionColor;
  const currentMotion: MotionData | undefined = beatData.motions[colorKey];
  if (!currentMotion) {
    logger.warn(`No motion data for ${color}`);
    return;
  }

  // Recalculate endOrientation for this beat based on its turns/motion type
  const orientationCalculator = container.items.orientationCalculator as IOrientationCalculator;

  const tempMotionData = createMotionData({
    ...currentMotion,
    startOrientation: orientation as MotionData["startOrientation"],
  });

  const newEndOrientation = orientationCalculator.calculateEndOrientation(
    tempMotionData,
    colorKey
  );

  // Create updated beat data with new startOrientation and recalculated endOrientation
  const updatedBeatData: BeatData = {
    ...beatData,
    motions: {
      ...beatData.motions,
      [colorKey]: {
        ...currentMotion,
        startOrientation: orientation as MotionData["startOrientation"],
        endOrientation: newEndOrientation,
      },
    },
  };

  // Get current sequence and start position for propagation calculation
  const currentSequence: SequenceData | null =
    createModuleState.sequenceState.currentSequence;
  const startPosition: StartPositionData | null = createModuleState.sequenceState
    .selectedStartPosition ?? null;

  // For start position (beat 0), we can update even without a sequence
  // For regular beats, we need a sequence to update
  if (!currentSequence && beatNumber !== START_POSITION_BEAT_NUMBER) {
    logger.warn("Cannot update beat orientation - no current sequence");
    return;
  }

  // Handle start position update when no sequence exists yet
  if (beatNumber === START_POSITION_BEAT_NUMBER && !currentSequence) {
    const updatedStartPosition = startPosition
      ? createStartPositionData({
          ...startPosition,
          motions: updatedBeatData.motions,
        })
      : null;

    if (updatedStartPosition) {
      createModuleState.sequenceState.setSelectedStartPosition(updatedStartPosition);
      logger.log(
        `Updated start position ${color} orientation to ${orientation} (no sequence yet)`
      );
    }
    return;
  }

  // At this point, currentSequence is guaranteed non-null (early returns handled above)
  const sequence = currentSequence!;

  // Build the updated sequence with the beat update + propagated orientations
  let updatedSequence: SequenceData = sequence;
  let updatedStartPosition: StartPositionData | null = startPosition;

  if (beatNumber === START_POSITION_BEAT_NUMBER) {
    // Create updated start position data with new orientation
    updatedStartPosition = startPosition
      ? createStartPositionData({
          ...startPosition,
          motions: updatedBeatData.motions,
        })
      : null;
    logger.log(
      `Updated start position ${color} orientation to ${orientation}, endOrientation to ${newEndOrientation}`
    );

    const propagatedBeats = calculatePropagatedBeats(
      beatNumber,
      color,
      sequence,
      updatedStartPosition
    );

    updatedSequence = {
      ...sequence,
      beats: propagatedBeats,
      // Include updated start position in the sequence so it propagates to selection state
      startPosition: updatedStartPosition ?? undefined,
      startingPositionBeat: updatedStartPosition ?? undefined,
    };

    // CRITICAL: Also update selectedStartPosition so the UI reflects the change
    if (updatedStartPosition) {
      createModuleState.sequenceState.setSelectedStartPosition(updatedStartPosition);
    }
  } else {
    const arrayIndex = beatNumber - 1;
    const updatedBeats = [...sequence.beats];
    updatedBeats[arrayIndex] = updatedBeatData;

    logger.log(
      `Updated beat ${beatNumber} ${color} orientation to ${orientation}, endOrientation to ${newEndOrientation}`
    );

    const propagatedBeats = calculatePropagatedBeats(
      beatNumber,
      color,
      { ...sequence, beats: updatedBeats },
      startPosition
    );

    updatedSequence = {
      ...sequence,
      beats: propagatedBeats,
    };
  }

  createModuleState.sequenceState.setCurrentSequence(updatedSequence);
}

/**
 * Calculate propagated beats without calling setCurrentSequence
 * Returns the updated beats array with all propagations applied
 * DOES NOT mutate state - caller must call setCurrentSequence
 */
export function calculatePropagatedBeats(
  startingBeatNumber: number,
  color: string,
  currentSequence: SequenceData,
  startPosition: StartPositionData | null
): BeatData[] {
  if (!currentSequence?.beats || currentSequence.beats.length === 0) {
    logger.log("No sequence beats to propagate through");
    return [...currentSequence.beats];
  }

  const orientationCalculator = container.items.orientationCalculator as IOrientationCalculator;

  // Get the starting beat's endOrientation
  let previousEndOrientation: MotionData["endOrientation"] | undefined;

  if (startingBeatNumber === START_POSITION_BEAT_NUMBER) {
    if (startPosition?.motions) {
      const motion: MotionData | undefined =
        startPosition.motions[color as MotionColor];
      if (motion) {
        previousEndOrientation = motion.endOrientation;
      }
    }
  } else {
    const arrayIndex = startingBeatNumber - 1;
    const startingBeat: BeatData | undefined =
      currentSequence.beats[arrayIndex];
    if (startingBeat?.motions) {
      const motion: MotionData | undefined =
        startingBeat.motions[color as MotionColor];
      if (motion) {
        previousEndOrientation = motion.endOrientation;
      }
    }
  }

  if (!previousEndOrientation) {
    logger.warn(
      `Cannot propagate - no endOrientation found for beat ${startingBeatNumber} ${color}`
    );
    return [...currentSequence.beats];
  }

  // Propagate through subsequent beats
  const updatedBeats: BeatData[] = [...currentSequence.beats];
  const propagationStartIndex =
    startingBeatNumber === START_POSITION_BEAT_NUMBER ? 0 : startingBeatNumber;

  logger.log(
    `🔄 Propagating ${color} orientations starting from beat ${startingBeatNumber} (endOrientation: ${previousEndOrientation})`
  );

  for (let i = propagationStartIndex; i < updatedBeats.length; i++) {
    const beat = updatedBeats[i];
    if (!beat) continue;

    // Runtime safety check - motions should always exist but validate to be safe
     
    if (!beat.motions) {
      logger.warn(`No motions data at beat ${i + 1}, stopping propagation`);
      break;
    }

    const beatMotion: MotionData | undefined =
      beat.motions[color as MotionColor];
    if (!beatMotion) {
      logger.warn(
        `No motion data for ${color} at beat ${i + 1}, stopping propagation`
      );
      break;
    }

    // Recalculate this beat's endOrientation
    const tempMotionData = createMotionData({
      ...beatMotion,
      startOrientation: previousEndOrientation,
    });

    const newEndOrientation = orientationCalculator.calculateEndOrientation(
      tempMotionData,
      color as MotionColor
    );

    // Update this beat's startOrientation and endOrientation
    const updatedMotion: MotionData = {
      ...beatMotion,
      startOrientation: previousEndOrientation,
      endOrientation: newEndOrientation,
    };

    updatedBeats[i] = {
      ...beat,
      motions: {
        ...beat.motions,
        [color]: updatedMotion,
      },
    };

    logger.log(
      `  ✓ Beat ${i + 1}: startOri=${previousEndOrientation} → endOri=${newEndOrientation}`
    );

    previousEndOrientation = newEndOrientation;
  }

  logger.success(
    `✅ Calculated propagation for ${color} orientations through ${updatedBeats.length - propagationStartIndex} beats`
  );

  return updatedBeats;
}
