/**
 * Duration Handler
 * Handles beat duration updates for the musical subdivision system.
 * Duration is a beat-level property (not per-color like turns).
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { ICreateModuleState } from "../../../types/create-module-types";
import { createComponentLogger } from "$lib/shared/utils/debug-logger";
import { getBeatDataFromState, START_POSITION_BEAT_NUMBER } from "./beat-data-helpers";

const logger = createComponentLogger("DurationHandler");

/** Minimum duration (¼ beat = 1 subdivision) */
export const MIN_DURATION = 0.25;

/** Maximum duration (4 beats = 16 subdivisions) */
export const MAX_DURATION = 4.0;

/** Fine step size (¼ beat) */
export const DURATION_STEP_FINE = 0.25;

/** Coarse step size (1 beat) */
export const DURATION_STEP_COARSE = 1.0;

/**
 * Update duration for a beat
 * @param beatNumber - The beat number (1-based, 0 = start position which doesn't have duration)
 * @param newDuration - The new duration value (will be clamped to valid range)
 * @param createModuleState - The create module state for accessing/updating sequence
 */
export function updateBeatDuration(
  beatNumber: number,
  newDuration: number,
  createModuleState: ICreateModuleState
): void {
  // Start position doesn't have duration
  if (beatNumber === START_POSITION_BEAT_NUMBER) {
    logger.warn("Cannot update duration for start position");
    return;
  }

  const beatData = getBeatDataFromState(beatNumber, createModuleState);

  if (!beatData) {
    logger.warn("Cannot update duration - no beat data available");
    return;
  }

  // Clamp to valid range
  const clampedDuration = Math.max(MIN_DURATION, Math.min(MAX_DURATION, newDuration));

  // Round to nearest valid step (0.25 increments)
  const roundedDuration = Math.round(clampedDuration / DURATION_STEP_FINE) * DURATION_STEP_FINE;

  // Skip if no change
  if (beatData.duration === roundedDuration) {
    return;
  }

  // Create updated beat data
  const updatedBeatData = {
    ...beatData,
    duration: roundedDuration,
  };

  // Get current sequence
  const currentSequence: SequenceData | null =
    createModuleState.sequenceState.currentSequence;

  if (!currentSequence) {
    logger.warn("Cannot update beat - no current sequence");
    return;
  }

  // Update the beat in the sequence
  const arrayIndex = beatNumber - 1;
  const updatedBeats = [...currentSequence.beats];
  updatedBeats[arrayIndex] = updatedBeatData;

  const updatedSequence: SequenceData = {
    ...currentSequence,
    beats: updatedBeats,
  };

  logger.log(`Updated beat ${beatNumber} duration to ${roundedDuration}`);

  createModuleState.sequenceState.setCurrentSequence(updatedSequence);
}
