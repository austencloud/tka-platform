/**
 * Turns Handler
 * Handles beat turns updates including float conversion and rotation direction auto-assignment.
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
import {
  MotionColor,
  MotionType,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { IReversalDetector } from "../../../services/contracts/IReversalDetector";
import { resolve } from "$lib/shared/inversify/di";
import { TYPES } from "$lib/shared/inversify/types";
import { createComponentLogger } from "$lib/shared/utils/debug-logger";
import {
  getBeatDataFromState,
  START_POSITION_BEAT_NUMBER,
} from "./beat-data-helpers";
import { calculatePropagatedBeats } from "./OrientationHandler";

const logger = createComponentLogger("TurnsHandler");

/**
 * Update turns for a specific prop color in a beat
 * Handles float conversion and auto-rotation direction assignment
 */
export function updateBeatTurns(
  beatNumber: number,
  color: string,
  turnAmount: number | "fl",
  createModuleState: ICreateModuleState
): void {
  const beatData = getBeatDataFromState(beatNumber, createModuleState);

  if (!beatData?.motions) {
    logger.warn("Cannot update turns - no beat data available");
    return;
  }

  const currentMotion: MotionData | undefined =
    beatData.motions[color as MotionColor];
  if (!currentMotion) {
    logger.warn(`No motion data for ${color}`);
    return;
  }

  const currentTurns = currentMotion.turns;

  // Detect float conversion scenarios
  const isConvertingToFloat = currentTurns !== "fl" && turnAmount === "fl";
  const isConvertingFromFloat = currentTurns === "fl" && turnAmount !== "fl";

  // Initialize updated motion properties
  let updatedMotionType = currentMotion.motionType;
  let updatedRotationDirection = currentMotion.rotationDirection;
  let updatedPrefloatMotionType = currentMotion.prefloatMotionType;
  let updatedPrefloatRotationDirection =
    currentMotion.prefloatRotationDirection;

  // Handle float conversion
  if (isConvertingToFloat) {
    updatedPrefloatMotionType = currentMotion.motionType;
    updatedPrefloatRotationDirection = currentMotion.rotationDirection;
    updatedMotionType = MotionType.FLOAT;
    updatedRotationDirection = RotationDirection.NO_ROTATION;
    logger.log(
      `Converting to float: storing prefloat state (motionType=${updatedPrefloatMotionType}, rotationDirection=${updatedPrefloatRotationDirection})`
    );
  } else if (isConvertingFromFloat) {
    if (currentMotion.prefloatMotionType) {
      updatedMotionType = currentMotion.prefloatMotionType;
    }
    if (currentMotion.prefloatRotationDirection) {
      updatedRotationDirection = currentMotion.prefloatRotationDirection;
    }
    logger.log(
      `Converting from float: restoring motion state (motionType=${updatedMotionType}, rotationDirection=${updatedRotationDirection})`
    );
  } else {
    // CRITICAL: Auto-assign rotation direction for DASH/STATIC motions (legacy behavior)
    // This matches legacy json_turns_updater.py lines 43-47 and 67-70
    const isDashOrStatic =
      updatedMotionType === MotionType.DASH ||
      updatedMotionType === MotionType.STATIC;

    if (isDashOrStatic) {
      if (
        typeof turnAmount === "number" &&
        turnAmount > 0 &&
        currentMotion.rotationDirection === RotationDirection.NO_ROTATION
      ) {
        updatedRotationDirection = RotationDirection.CLOCKWISE;
        logger.log(
          `Auto-assigned CLOCKWISE rotation to ${updatedMotionType} motion with ${turnAmount} turns`
        );
      } else if (turnAmount === 0) {
        updatedRotationDirection = RotationDirection.NO_ROTATION;
      }
    }
  }

  // Recalculate endOrientation based on new turn amount and updated rotation direction
  const orientationCalculator = resolve<IOrientationCalculator>(
    TYPES.IOrientationCalculator
  );
  const tempMotionData = createMotionData({
    ...currentMotion,
    turns: turnAmount,
    rotationDirection: updatedRotationDirection,
    motionType: updatedMotionType,
  });
  const newEndOrientation = orientationCalculator.calculateEndOrientation(
    tempMotionData,
    color as MotionColor
  );

  // Create updated beat data
  const updatedBeatData = {
    ...beatData,
    motions: {
      ...beatData.motions,
      [color]: {
        ...currentMotion,
        turns: turnAmount,
        motionType: updatedMotionType,
        rotationDirection: updatedRotationDirection,
        prefloatMotionType: updatedPrefloatMotionType,
        prefloatRotationDirection: updatedPrefloatRotationDirection,
        endOrientation: newEndOrientation,
      },
    },
  };

  // Get current sequence and start position for propagation calculation
  const currentSequence: SequenceData | null =
    createModuleState.sequenceState.currentSequence;
  const startPosition: StartPositionData | null = createModuleState.sequenceState
    .selectedStartPosition ?? null;

  if (!currentSequence) {
    logger.warn("Cannot update beat - no current sequence");
    return;
  }

  // Build the updated sequence with the beat update + propagated orientations
  let updatedSequence = currentSequence;
  let updatedStartPosition: StartPositionData | null = startPosition;

  if (beatNumber === START_POSITION_BEAT_NUMBER) {
    // Create updated start position with new motions
    updatedStartPosition = startPosition
      ? createStartPositionData({
          ...startPosition,
          motions: updatedBeatData.motions,
        })
      : null;
    logger.log(
      `Updated start position ${color} turns to ${turnAmount} (rotationDirection: ${updatedRotationDirection}, endOrientation: ${newEndOrientation})`
    );

    const propagatedBeats = calculatePropagatedBeats(
      beatNumber,
      color,
      currentSequence,
      updatedStartPosition
    );

    updatedSequence = {
      ...currentSequence,
      beats: propagatedBeats,
    };
  } else {
    const arrayIndex = beatNumber - 1;
    const updatedBeats = [...currentSequence.beats];
    updatedBeats[arrayIndex] = updatedBeatData;

    logger.log(
      `Updated beat ${beatNumber} ${color} turns to ${turnAmount} (rotationDirection: ${updatedRotationDirection}, endOrientation: ${newEndOrientation})`
    );

    const propagatedBeats = calculatePropagatedBeats(
      beatNumber,
      color,
      { ...currentSequence, beats: updatedBeats },
      startPosition
    );

    updatedSequence = {
      ...currentSequence,
      beats: propagatedBeats,
    };
  }

  // Process reversals to update reversal indicators after turns change
  // Turns changes can affect reversals when rotation direction changes (e.g., 0 to >0 turns)
  try {
    const reversalService = resolve<IReversalDetector>(TYPES.IReversalDetector);
    updatedSequence = reversalService.processReversals(updatedSequence);
  } catch {
    // Reversal service is optional - continue without reversal processing
  }

  createModuleState.sequenceState.setCurrentSequence(updatedSequence);
}
