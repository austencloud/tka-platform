/**
 * Undo Controller
 *
 * Wraps the undo service so the create module state can stay declarative.
 * Handles snapshotting, callbacks, and the animation-friendly undo flow.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { SequenceState } from "../sequence-state-orchestrator.svelte";
import type { UndoManager } from "../../services/undo-manager";
import type { UndoMetadata } from "../../services/undo-manager";
import { UndoOperationType } from "../../services/undo-manager";
import type { BuildModeId } from "$lib/shared/foundation/ui/ui-types";
import { toast } from "$lib/shared/toast/state/toast-state.svelte";
import { clearPropPositionCache } from "$lib/shared/pictograph/prop/prop-position-cache";
import { clearArrowPositionCache } from "$lib/shared/pictograph/arrow/rendering/arrow-position-cache";
import { setSuppressNextAnimation } from "../../workspace-panel/sequence-display/state/step-grid-display-state.svelte";
import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";

type UndoControllerDeps = {
  UndoManager: UndoManager;
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
  let onUndoingOptionCallback: ((isUndoing: boolean) => void) | null = null; // eslint-disable-line @typescript-eslint/no-unused-vars

  let undoChangeCounter = $state(0);
  let historySuspended = $state(false);

  UndoManager.onChange(() => {
    undoChangeCounter++;
  });

  /**
   * Suppress all visual transitions before restoring a sequence.
   * Disables: StepGrid entrance animations, prop/arrow CSS transitions,
   * and position cache slide-in effects.
   */
  function suppressTransitionsForRestore() {
    setSuppressNextAnimation(true);
    clearPropPositionCache();
    clearArrowPositionCache();

    // Temporarily disable CSS transitions on props/arrows via the
    // "transforming" flag (adds .no-transition class). Re-enable after
    // the browser paints the restored state.
    const visManager = getAnimationVisibilityManager();
    visManager.setTransforming(true);
    requestAnimationFrame(() => {
      visManager.setTransforming(false);
    });
  }

  function pushUndoSnapshot(type: UndoOperationType, metadata?: UndoMetadata) {
    if (historySuspended) {
      return;
    }

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
            steps: currentSequenceRef.steps.map((step) =>
              step ? { ...step } : step
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
    if (historySuspended) {
      return false;
    }

    const currentSection = getActiveSection();

    // Only undo entries from the current tab
    const lastEntry = UndoManager.undo(currentSection);
    if (!lastEntry) {
      return false;
    }

    const undoDescription =
      lastEntry.metadata?.description ||
      UndoManager.getOperationDescription(lastEntry.type);

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

    suppressTransitionsForRestore();

    // Restore the sequence directly
    sequenceState.setCurrentSequence(lastEntry.beforeState.sequence);
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
    if (historySuspended) {
      return false;
    }

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

    suppressTransitionsForRestore();

    // Restore the sequence from the after state
    sequenceState.setCurrentSequence(afterState.sequence);
    restoreSelection(afterState.selectedStepNumber);

    return true;
  }

  function clearUndoHistory() {
    if (historySuspended) {
      return;
    }

    UndoManager.clearHistory();
  }

  function suspendHistory(): void {
    historySuspended = true;
  }

  function resumeHistory(): void {
    historySuspended = false;
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
    if (historySuspended) {
      return false;
    }

    // Get timeline to find the entry
    const timeline = UndoManager.getTimeline();
    const entry = timeline.find((e) => e.id === entryId);
    if (!entry) return false;

    // Perform the jump in the manager
    const result = UndoManager.jumpToState(entryId);
    if (!result) return false;

    suppressTransitionsForRestore();

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
    suspendHistory,
    resumeHistory,
    jumpToState,
    setShowStartPositionPickerCallback,
    setSyncPickerStateCallback,
    setOnUndoingOptionCallback,
    get canUndo() {
      void undoChangeCounter;
      return (
        !historySuspended && UndoManager.canUndoForSection(getActiveSection())
      );
    },
    get canRedo() {
      void undoChangeCounter;
      return !historySuspended && UndoManager.canRedo;
    },
    get undoHistory() {
      return historySuspended ? [] : UndoManager.undoHistory;
    },
    get redoHistory() {
      return historySuspended ? [] : UndoManager.redoHistory;
    },
    get nextUndoEntry() {
      void undoChangeCounter;
      return historySuspended
        ? null
        : UndoManager.getLastUndoEntry(getActiveSection());
    },
    getTimeline() {
      void undoChangeCounter;
      return historySuspended ? [] : UndoManager.getTimeline();
    },
    getOperationDescription(type: UndoOperationType) {
      return UndoManager.getOperationDescription(type);
    },
  };
}

export type UndoController = ReturnType<typeof createUndoController>;
