/**
 * Beat Data Helpers
 * Shared utilities for beat operations - retrieval, constants, and common operations.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { BeatData } from "../../../domain/models/BeatData";
import type { ICreateModuleState } from "../../../types/create-module-types";

/** Beat 0 = start position, beats 1+ are in the sequence */
export const START_POSITION_BEAT_NUMBER = 0;

/**
 * Get beat data from the live sequence state
 * @returns Beat data or null/undefined if not found
 */
export function getBeatDataFromState(
  beatNumber: number,
  createModuleState: ICreateModuleState
): BeatData | null | undefined {
  if (beatNumber === START_POSITION_BEAT_NUMBER) {
    return createModuleState.sequenceState
      .selectedStartPosition as unknown as BeatData | null;
  }

  const arrayIndex = beatNumber - 1;
  const sequence: SequenceData | null =
    createModuleState.sequenceState.currentSequence;
  return sequence?.beats[arrayIndex];
}

/**
 * Update the sequence word based on current beat letters
 */
export function updateSequenceWord(
  createModuleState: ICreateModuleState
): void {
  const sequence = createModuleState.sequenceState.currentSequence;
  if (!sequence?.beats) return;

  const word = sequence.beats
    .map((beat) => beat.letter ?? "")
    .join("")
    .toUpperCase();

  const updatedSequence: SequenceData = {
    ...sequence,
    word,
  };

  createModuleState.sequenceState.setCurrentSequence(updatedSequence);
}
