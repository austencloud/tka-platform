/**
 * Batch Edit Handler
 * Handles applying changes to multiple selected beats at once.
 */

import type {
  ICreateModuleState,
  BatchEditChanges,
} from "../../../types/create-module-types";
import { UndoOperationType } from "../../../services/contracts/IUndoManager";
import { createComponentLogger } from "$lib/shared/utils/debug-logger";

const logger = createComponentLogger("BatchEdit");

/**
 * Apply batch changes to all selected beats
 */
export function applyBatchChanges(
  changes: BatchEditChanges,
  createModuleState: ICreateModuleState
): void {
  const selectedBeatNumbers =
    createModuleState.sequenceState.selectedBeatNumbers;

  if (selectedBeatNumbers.size === 0) {
    logger.warn("No beats selected for batch edit");
    return;
  }

  logger.log(
    `Applying batch changes to ${selectedBeatNumbers.size} beats`,
    changes
  );

  // Push undo snapshot before batch edit
  createModuleState.pushUndoSnapshot(UndoOperationType.BATCH_EDIT, {
    beatNumbers: Array.from(selectedBeatNumbers),
    changes,
    description: `Batch edit ${selectedBeatNumbers.size} beats`,
  });

  const currentSequence = createModuleState.sequenceState.currentSequence;
  if (!currentSequence) {
    logger.warn("No active sequence to apply batch changes");
    return;
  }

  const updatedBeats = currentSequence.beats.map((beat) => {
    if (!selectedBeatNumbers.has(beat.beatNumber)) return beat;

    const nextMotions =
      changes.motions && beat.motions
        ? { ...beat.motions, ...changes.motions }
        : beat.motions;

    return {
      ...beat,
      ...changes,
      motions: nextMotions,
    };
  });

  createModuleState.sequenceState.setCurrentSequence({
    ...currentSequence,
    beats: updatedBeats,
  });

  logger.success(`Applied batch changes to ${selectedBeatNumbers.size} beats`);
}
