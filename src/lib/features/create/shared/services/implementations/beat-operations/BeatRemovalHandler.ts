/**
 * Beat Removal Handler
 * Handles beat removal logic including clearing entire sequence when start position is removed.
 */

import type { ICreateModuleState } from "../../../types/create-module-types";
import { UndoOperationType } from "../../../services/contracts/IUndoManager";
import { createComponentLogger } from "$lib/shared/utils/debug-logger";

const logger = createComponentLogger("BeatRemoval");

/**
 * Remove a beat and all subsequent beats from the sequence
 */
export function removeBeat(
  beatIndex: number,
  createModuleState: ICreateModuleState
): void {
  const selectedBeat = createModuleState.sequenceState.selectedBeatData;

  // Special case: Removing start position (beatNumber === 0) clears entire sequence
  if (selectedBeat?.beatNumber === 0) {
    logger.log("Removing start position - clearing entire sequence");

    createModuleState.pushUndoSnapshot(UndoOperationType.CLEAR_SEQUENCE, {
      description: "Clear sequence (removed start position)",
    });

    void createModuleState.sequenceState.clearSequenceCompletely();
    createModuleState.setActiveToolPanel("constructor");
    return;
  }

  // Calculate how many beats will be removed (beat at index + all subsequent)
  const currentSequence = createModuleState.sequenceState.currentSequence;
  const beatsToRemove = currentSequence
    ? currentSequence.beats.length - beatIndex
    : 0;

  logger.log(
    `Removing beat ${beatIndex} and ${beatsToRemove - 1} subsequent beats`
  );

  // Push undo snapshot before removal
  createModuleState.pushUndoSnapshot(UndoOperationType.REMOVE_BEATS, {
    beatIndex,
    beatsRemoved: beatsToRemove,
    description: `Remove beat ${beatIndex} and ${beatsToRemove - 1} subsequent beats`,
  });

  // Remove the beat and all subsequent beats with staggered animation
  createModuleState.sequenceState.removeBeatAndSubsequentWithAnimation(
    beatIndex,
    () => {
      // After animation completes, select appropriate beat
      if (beatIndex > 0) {
        // Select the previous beat (array index beatIndex-1 has beatNumber beatIndex)
        createModuleState.sequenceState.selectBeat(beatIndex);
      } else {
        // If removing beat 0 (first beat after start), select start position
        createModuleState.sequenceState.selectStartPositionForEditing();
      }
    }
  );
}
