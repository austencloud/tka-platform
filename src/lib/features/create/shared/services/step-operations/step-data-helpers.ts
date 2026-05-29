/**
 * Beat Data Helpers
 * Shared utilities for beat operations - retrieval, constants, and common operations.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
import type { ICreateModuleState } from "../../types/create-module-types";

/** Beat 0 = start position, steps 1+ are in the sequence */
export const START_POSITION_BEAT_NUMBER = 0;

/**
 * Get step data from the live sequence state
 * @returns Beat data or null/undefined if not found
 */
export function getStepDataFromState(
  stepNumber: number,
  createModuleState: ICreateModuleState
): StepData | null | undefined {
  if (stepNumber === START_POSITION_BEAT_NUMBER) {
    return createModuleState.sequenceState
      .selectedStartPosition as unknown as StepData | null;
  }

  const arrayIndex = stepNumber - 1;
  const sequence: SequenceData | null =
    createModuleState.sequenceState.currentSequence;
  return sequence?.steps[arrayIndex];
}

/**
 * Update the sequence word based on current beat letters
 */
export function updateSequenceWord(
  createModuleState: ICreateModuleState
): void {
  const sequence = createModuleState.sequenceState.currentSequence;
  if (!sequence?.steps) return;

  const word = sequence.steps
    .map((step) => step.letter ?? "")
    .join("")
    .toUpperCase();

  const updatedSequence: SequenceData = {
    ...sequence,
    word,
  };

  createModuleState.sequenceState.setCurrentSequence(updatedSequence);
}
