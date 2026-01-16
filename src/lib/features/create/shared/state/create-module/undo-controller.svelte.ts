/**
 * Undo Controller
 *
 * Wraps the undo service so the create module state can stay declarative.
 * Handles snapshotting, callbacks, and the animation-friendly undo flow.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { SequenceState } from "../SequenceStateOrchestrator.svelte";
import type {
  IUndoManager,
  UndoMetadata,
} from "../../services/contracts/IUndoManager";
import { UndoOperationType } from "../../services/contracts/IUndoManager";
import type { BuildModeId } from "$lib/shared/foundation/ui/UITypes";
import { toast } from "$lib/shared/toast/state/toast-state.svelte";

type UndoControllerDeps = {
  UndoManager: IUndoManager;
  sequenceState: SequenceState;
  getActiveSection: () => BuildModeId;
  setActiveSectionInternal: (
    panel: BuildModeId,
    addToHistory?: boolean
  ) => Promise<void>;
};

/**
 * Subset of UndoOperationType used for snapshot operations
 * @deprecated Use UndoOperationType directly
 */
export type UndoSnapshotType = UndoOperationType;

export function createUndoController({
  UndoManager,
  sequenceState,
  getActiveSection,
  setActiveSectionInternal,
}: UndoControllerDeps) {
  let showStartPositionPickerCallback: (() => void) | null = null;
  let syncPickerStateCallback: (() => void) | null = null;
  let onUndoingOptionCallback: ((isUndoing: boolean) => void) | null = null;

  let undoChangeCounter = $state(0);

  UndoManager.onChange(() => {
    undoChangeCounter++;
  });

  function pushUndoSnapshot(type: UndoOperationType, metadata?: UndoMetadata) {
    if (
      !sequenceState.currentSequence &&
      type !== UndoOperationType.SELECT_START_POSITION
    ) {
      return;
    }

    const currentSequenceRef = sequenceState.currentSequence;
    const selectedStepNumberRef = sequenceState.selectedStepNumber;
    const activeSectionRef = getActiveSection();
    const timestampRef = Date.now();

    queueMicrotask(() => {
      const sequenceCopy: SequenceData | null = currentSequenceRef
        ? {
            ...currentSequenceRef,
            steps: currentSequenceRef.steps.map((beat) =>
              beat ? { ...beat } : beat
            ),
          }
        : null;

      const beforeState = {
        sequence: sequenceCopy,
        selectedStepNumber: selectedStepNumberRef,
        activeSection: activeSectionRef,
        shouldShowStartPositionPicker:
          type === UndoOperationType.SELECT_START_POSITION,
        timestamp: timestampRef,
      };

      UndoManager.pushUndo(type, beforeState, metadata);
    });
  }

  function undo(): boolean {
    // Get description before undo (entry moves to redo after)
    const undoDescription = UndoManager.getLastUndoDescription();

    const lastEntry = UndoManager.undo();
    if (!lastEntry) {
      return false;
    }

    // Show brief toast confirming the undo
    if (undoDescription) {
      toast.info(`Undid ${undoDescription}`, 1500);
    }

    if (lastEntry.type === UndoOperationType.SELECT_START_POSITION) {
      void sequenceState.clearSequenceCompletely();
      if (showStartPositionPickerCallback) {
        showStartPositionPickerCallback();
      }
      return true;
    }

    const currentSequence = sequenceState.currentSequence;
    const restoredSequence = lastEntry.beforeState.sequence;

    if (currentSequence && restoredSequence) {
      const currentStepCount = currentSequence.steps.length;
      const restoredStepCount = restoredSequence.steps.length;

      if (currentStepCount > restoredStepCount) {
        const stepsToRemove: number[] = [];
        for (let i = restoredStepCount; i < currentStepCount; i++) {
          stepsToRemove.push(i);
        }

        sequenceState.animationState.startRemovingBeats(stepsToRemove);
        if (onUndoingOptionCallback) {
          onUndoingOptionCallback(true);
        }

        const fadeAnimationDuration = 250;
        setTimeout(() => {
          sequenceState.setCurrentSequence(restoredSequence);
          sequenceState.animationState.endRemovingBeats();

          if (onUndoingOptionCallback) {
            onUndoingOptionCallback(false);
          }

          restoreSelection(lastEntry.beforeState.selectedStepNumber);
          if (lastEntry.beforeState.activeSection) {
            void setActiveSectionInternal(
              lastEntry.beforeState.activeSection,
              false
            );
          }

          if (syncPickerStateCallback) {
            syncPickerStateCallback();
          }
        }, fadeAnimationDuration);

        return true;
      }
    }

    sequenceState.setCurrentSequence(restoredSequence);
    restoreSelection(lastEntry.beforeState.selectedStepNumber);
    if (lastEntry.beforeState.activeSection) {
      void setActiveSectionInternal(lastEntry.beforeState.activeSection, false);
    }

    if (syncPickerStateCallback) {
      syncPickerStateCallback();
    }

    return true;
  }

  function restoreSelection(selectedStepNumber: number | null) {
    if (selectedStepNumber !== null) {
      sequenceState.selectStep(selectedStepNumber);
    } else {
      sequenceState.clearSelection();
    }
  }

  function redo(): boolean {
    const entry = UndoManager.redo();
    if (!entry) {
      return false;
    }

    // For redo, we want to restore the state that was undone
    // This is typically stored in afterState, or we can get it from the current position
    const afterState = entry.afterState;
    if (!afterState) {
      // If no afterState, just return true (the service already moved it back to undo history)
      return true;
    }

    // Restore the sequence from the after state
    sequenceState.setCurrentSequence(afterState.sequence);
    restoreSelection(afterState.selectedStepNumber);

    return true;
  }

  function clearUndoHistory() {
    UndoManager.clearHistory();
  }

  function setShowStartPositionPickerCallback(callback: () => void) {
    showStartPositionPickerCallback = callback;
  }

  function setSyncPickerStateCallback(callback: () => void) {
    syncPickerStateCallback = callback;
  }

  function setOnUndoingOptionCallback(callback: (isUndoing: boolean) => void) {
    onUndoingOptionCallback = callback;
  }

  /**
   * Jump to a specific history entry and restore that state
   * Used by history panel to allow jumping to any point in history
   */
  function jumpToState(entryId: string): boolean {
    // Get timeline to find the entry
    const timeline = UndoManager.getTimeline();
    const entry = timeline.find((e) => e.id === entryId);
    if (!entry) return false;

    // Perform the jump in the manager
    const result = UndoManager.jumpToState(entryId);
    if (!result) return false;

    // Restore the state from the entry's beforeState
    if (entry.type === UndoOperationType.SELECT_START_POSITION) {
      void sequenceState.clearSequenceCompletely();
      if (showStartPositionPickerCallback) {
        showStartPositionPickerCallback();
      }
    } else {
      sequenceState.setCurrentSequence(entry.beforeState.sequence);
      restoreSelection(entry.beforeState.selectedStepNumber);
      if (entry.beforeState.activeSection) {
        void setActiveSectionInternal(entry.beforeState.activeSection, false);
      }
    }

    if (syncPickerStateCallback) {
      syncPickerStateCallback();
    }

    // Show toast indicating the jump
    const description =
      entry.metadata?.description ||
      UndoManager.getOperationDescription(entry.type);
    toast.info(`Jumped to: ${description}`, 1500);

    return true;
  }

  return {
    pushUndoSnapshot,
    undo,
    redo,
    clearUndoHistory,
    jumpToState,
    setShowStartPositionPickerCallback,
    setSyncPickerStateCallback,
    setOnUndoingOptionCallback,
    get canUndo() {
      void undoChangeCounter;
      return UndoManager.canUndo;
    },
    get canRedo() {
      void undoChangeCounter;
      return UndoManager.canRedo;
    },
    get undoHistory() {
      return UndoManager.undoHistory;
    },
    get redoHistory() {
      return UndoManager.redoHistory;
    },
    getTimeline() {
      void undoChangeCounter;
      return UndoManager.getTimeline();
    },
    getOperationDescription(type: UndoOperationType) {
      return UndoManager.getOperationDescription(type);
    },
  };
}

export type UndoController = ReturnType<typeof createUndoController>;
