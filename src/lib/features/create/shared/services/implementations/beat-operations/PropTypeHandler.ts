/**
 * Prop Type Handler
 * Handles prop type updates for individual beats and bulk operations.
 */

import type { BeatData } from "../../../domain/models/BeatData";
import { createStartPositionData } from "../../../domain/factories/createStartPositionData";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type { ICreateModuleState } from "../../../types/create-module-types";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { createComponentLogger } from "$lib/shared/utils/debug-logger";
import {
  getBeatDataFromState,
  START_POSITION_BEAT_NUMBER,
} from "./beat-data-helpers";

const logger = createComponentLogger("PropTypeHandler");

/**
 * Update prop type for a specific color in a single beat
 */
export function updateBeatPropType(
  beatNumber: number,
  color: string,
  propType: PropType,
  createModuleState: ICreateModuleState
): void {
  const beatData = getBeatDataFromState(beatNumber, createModuleState);

  if (!beatData?.motions) {
    logger.warn("Cannot update prop type - no beat data available");
    return;
  }

  const currentMotion: MotionData | undefined =
    beatData.motions[color as MotionColor];
  if (!currentMotion) {
    logger.warn(`No motion data for ${color}`);
    return;
  }

  const updatedMotion = {
    ...currentMotion,
    propType: propType,
  };

  const updatedBeatData = {
    ...beatData,
    motions: {
      ...beatData.motions,
      [color]: updatedMotion,
    },
  };

  if (beatNumber === START_POSITION_BEAT_NUMBER) {
    // Convert to proper StartPositionData when updating start position
    const updatedStartPosition = createStartPositionData({
      ...beatData,
      motions: {
        ...beatData.motions,
        [color]: updatedMotion,
      },
    });
    createModuleState.sequenceState.setStartPosition(updatedStartPosition);
    logger.log(`Updated start position ${color} prop type to ${propType}`);
  } else {
    const arrayIndex = beatNumber - 1;
    createModuleState.sequenceState.updateBeat(arrayIndex, updatedBeatData);
    logger.log(`Updated beat ${beatNumber} ${color} prop type to ${propType}`);
  }
}

/**
 * Bulk update prop type for all motions of a specific color in the sequence
 * Updates both the start position and all beats
 */
export function bulkUpdatePropType(
  color: string,
  propType: PropType,
  createModuleState: ICreateModuleState
): void {
  // Update start position
  const startPosition = createModuleState.sequenceState.selectedStartPosition;
  if (startPosition?.motions) {
    const currentMotion = startPosition.motions[color as MotionColor];
    if (currentMotion) {
      const updatedMotion = {
        ...currentMotion,
        propType: propType,
      };
      const updatedStartPosition = createStartPositionData({
        ...startPosition,
        motions: {
          ...startPosition.motions,
          [color]: updatedMotion,
        },
      });
      createModuleState.sequenceState.setStartPosition(updatedStartPosition);
      logger.log(`Updated start position ${color} prop type to ${propType}`);
    }
  }

  // Update all beats in the sequence
  const sequence = createModuleState.sequenceState.currentSequence;
  if (sequence?.beats) {
    const updatedBeats = sequence.beats.map((beat: BeatData) => {
      if (!beat.motions) return beat;

      const currentMotion = beat.motions[color as MotionColor];
      if (!currentMotion) return beat;

      const updatedMotion = {
        ...currentMotion,
        propType: propType,
      };

      return {
        ...beat,
        motions: {
          ...beat.motions,
          [color]: updatedMotion,
        },
      };
    });

    const updatedSequence = {
      ...sequence,
      beats: updatedBeats,
    };

    createModuleState.sequenceState.setCurrentSequence(updatedSequence);
    logger.log(
      `Updated ${updatedBeats.length} beats: ${color} prop type to ${propType}`
    );
  }
}
