/**
 * Batch Edit Handler
 * Handles applying changes to multiple selected steps at once.
 */

import type {
  ICreateModuleState,
  BatchEditChanges,
} from "../../types/create-module-types";
import { UndoOperationType } from "../undo-manager";
import { createComponentLogger } from "$lib/shared/utils/debug-logger";

const logger = createComponentLogger("BatchEdit");

/**
 * Apply batch changes to all selected steps
 */
export function applyBatchChanges(
  changes: BatchEditChanges,
  createModuleState: ICreateModuleState
): void {
  const selectedStepNumbers =
    createModuleState.sequenceState.selectedStepNumbers;

  if (selectedStepNumbers.size === 0) {
    logger.warn("No steps selected for batch edit");
    return;
  }

  logger.log(
    `Applying batch changes to ${selectedStepNumbers.size} steps`,
    changes
  );

  // Push undo snapshot before batch edit
  createModuleState.pushUndoSnapshot(UndoOperationType.BATCH_EDIT, {
    stepNumbers: Array.from(selectedStepNumbers),
    changes,
    description: `Batch edit ${selectedStepNumbers.size} steps`,
  });

  const currentSequence = createModuleState.sequenceState.currentSequence;
  if (!currentSequence) {
    logger.warn("No active sequence to apply batch changes");
    return;
  }

  const updatedSteps = currentSequence.steps.map((step) => {
    if (!selectedStepNumbers.has(step.stepNumber)) return step;

    const nextMotions =
      changes.motions && step.motions
        ? { ...step.motions, ...changes.motions }
        : step.motions;

    return {
      ...step,
      ...changes,
      motions: nextMotions,
    };
  });

  createModuleState.sequenceState.setCurrentSequence({
    ...currentSequence,
    steps: updatedSteps,
  });

  logger.success(`Applied batch changes to ${selectedStepNumbers.size} steps`);
}
