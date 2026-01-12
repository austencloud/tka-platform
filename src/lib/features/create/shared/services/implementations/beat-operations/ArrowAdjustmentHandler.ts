/**
 * Arrow Adjustment Handler
 * Persists manual arrow position adjustments to the sequence state.
 */

import type { BeatData } from "../../../domain/models/BeatData";
import type { StartPositionData } from "../../../domain/models/StartPositionData";
import { createStartPositionData } from "../../../domain/factories/createStartPositionData";
import type { ICreateModuleState } from "../../../types/create-module-types";
import type { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { createComponentLogger } from "$lib/shared/utils/debug-logger";
import { getBeatDataFromState, START_POSITION_BEAT_NUMBER } from "./beat-data-helpers";
import { UndoOperationType } from "../../../services/contracts/IUndoManager";

const logger = createComponentLogger("ArrowAdjustmentHandler");

/**
 * Persist arrow adjustment to sequence state
 * Updates the manualAdjustmentX/Y values on the motion's arrowPlacementData
 */
export function updateArrowAdjustment(
  beatNumber: number,
  color: string,
  adjustmentX: number,
  adjustmentY: number,
  createModuleState: ICreateModuleState
): void {
  const beatData = getBeatDataFromState(beatNumber, createModuleState);

  if (!beatData?.motions) {
    logger.warn("Cannot update arrow adjustment - no beat data available");
    return;
  }

  const colorKey = color as MotionColor;
  const currentMotion = beatData.motions[colorKey];
  if (!currentMotion) {
    logger.warn(`No motion data for ${color}`);
    return;
  }

  // Create updated beat data with new manual adjustments
  const updatedBeatData: BeatData = {
    ...beatData,
    motions: {
      ...beatData.motions,
      [colorKey]: {
        ...currentMotion,
        arrowPlacementData: {
          ...currentMotion.arrowPlacementData,
          manualAdjustmentX: adjustmentX,
          manualAdjustmentY: adjustmentY,
        },
      },
    },
  };

  // Get current sequence for update
  const currentSequence = createModuleState.sequenceState.currentSequence;

  if (!currentSequence) {
    logger.warn("Cannot update arrow adjustment - no current sequence");
    return;
  }

  if (beatNumber === START_POSITION_BEAT_NUMBER) {
    // Update start position
    const startPosition = createModuleState.sequenceState.selectedStartPosition;
    const updatedStartPosition = startPosition
      ? createStartPositionData({
          ...startPosition,
          motions: updatedBeatData.motions,
        })
      : null;

    const updatedSequence = {
      ...currentSequence,
      startPosition: updatedStartPosition ?? undefined,
      startingPositionBeat: updatedStartPosition ?? undefined,
    };

    createModuleState.sequenceState.setCurrentSequence(updatedSequence);
    logger.success(
      `Updated start position ${color} arrow adjustment to (${adjustmentX}, ${adjustmentY})`
    );
  } else {
    // Update beat in sequence
    const arrayIndex = beatNumber - 1;
    const updatedBeats = [...currentSequence.beats];
    updatedBeats[arrayIndex] = updatedBeatData;

    const updatedSequence = {
      ...currentSequence,
      beats: updatedBeats,
    };

    createModuleState.sequenceState.setCurrentSequence(updatedSequence);
    logger.success(
      `Updated beat ${beatNumber} ${color} arrow adjustment to (${adjustmentX}, ${adjustmentY})`
    );
  }
}

/**
 * Persist complete beat data with arrow adjustments
 * Used when the adjustment panel closes to save all accumulated changes
 */
export function persistBeatWithAdjustments(
  beatNumber: number,
  updatedBeatData: BeatData,
  createModuleState: ICreateModuleState
): void {
  const currentSequence = createModuleState.sequenceState.currentSequence;

  if (!currentSequence) {
    logger.warn("Cannot persist beat - no current sequence");
    return;
  }

  // Push undo snapshot before applying changes
  createModuleState.pushUndoSnapshot(UndoOperationType.MODIFY_BEAT_PROPERTIES, {
    beatIndex: beatNumber,
    description: `Adjust arrow positions for beat ${beatNumber === START_POSITION_BEAT_NUMBER ? "start position" : beatNumber}`,
  });

  if (beatNumber === START_POSITION_BEAT_NUMBER) {
    // Update start position - get the existing start position data to preserve its properties
    const existingStartPosition = createModuleState.sequenceState.selectedStartPosition;
    if (!existingStartPosition) {
      logger.warn("Cannot persist start position - no existing start position");
      return;
    }

    const updatedStartPosition = createStartPositionData({
      ...existingStartPosition,
      motions: updatedBeatData.motions,
    });

    const updatedSequence = {
      ...currentSequence,
      startPosition: updatedStartPosition,
      startingPositionBeat: updatedStartPosition,
    };

    createModuleState.sequenceState.setCurrentSequence(updatedSequence);
    logger.success(`Persisted start position arrow adjustments`);
  } else {
    // Update beat in sequence
    const arrayIndex = beatNumber - 1;
    const updatedBeats = [...currentSequence.beats];
    updatedBeats[arrayIndex] = updatedBeatData;

    const updatedSequence = {
      ...currentSequence,
      beats: updatedBeats,
    };

    createModuleState.sequenceState.setCurrentSequence(updatedSequence);
    logger.success(`Persisted beat ${beatNumber} arrow adjustments`);
  }
}
