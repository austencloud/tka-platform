/**
 * Auto Edit Panel Manager
 *
 * Handles automatic opening of edit panel when multiple steps are selected.
 * Consolidates multi-select edit panel logic from CreateModule.svelte.
 *
 * Domain: Create module - Edit Panel Automation
 */

import { createComponentLogger } from "$lib/shared/utils/debug-logger";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { PanelCoordinationState } from "../panel-coordination-state.svelte";
import type { createCreateModuleState as CreateModuleStateType } from "../create-module-state.svelte";

type CreateModuleState = ReturnType<typeof CreateModuleStateType>;

// Lazy logger initialization to avoid circular dependency issues
let logger: ReturnType<typeof createComponentLogger> | null = null;
const getLogger = () => {
  if (!logger) {
    logger = createComponentLogger("AutoEditPanelManager");
  }
  return logger;
};

const START_POSITION_BEAT_NUMBER = 0;

export interface AutoEditPanelConfig {
  CreateModuleState: CreateModuleState;
  panelState: PanelCoordinationState;
  /** Optional: Direct getter for selectedStepNumber to ensure reactivity */
  getSelectedStepNumber?: () => number | null;
}

/**
 * Creates auto-open edit panel effect for multi-select
 * @returns Cleanup function
 */
export function createAutoEditPanelEffect(
  config: AutoEditPanelConfig
): () => void {
  const { CreateModuleState, panelState } = config;

  return $effect.root(() => {
    $effect(() => {
      const selectedStepNumbers =
        CreateModuleState.sequenceState.selectedStepNumbers;
      const selectedCount = selectedStepNumbers.size ?? 0;

      if (selectedCount > 1 && !panelState.isStepEditorPanelOpen) {
        // Map beat numbers to step data
        const stepNumbersArray = Array.from(selectedStepNumbers).sort(
          (a, b) => a - b
        );
        const stepsData = stepNumbersArray
          .map((stepNumber) => {
            if (stepNumber === START_POSITION_BEAT_NUMBER) {
              // Beat 0 is the start position
              return CreateModuleState.sequenceState.selectedStartPosition;
            } else {
              // Steps are numbered 1, 2, 3... but stored in array at indices 0, 1, 2...
              const stepIndex = stepNumber - 1;
              return CreateModuleState.sequenceState.currentSequence?.steps[
                stepIndex
              ];
            }
          })
          .filter(
            (beat): beat is StepData => beat !== null && beat !== undefined
          ); // Remove any null/undefined values

        getLogger().log(
          `Auto-opening batch edit panel: ${selectedCount} steps selected`
        );
        panelState.openBatchEditPanel(stepsData);
      }
    });
  });
}

/**
 * Creates auto-open effect for Beat Editor panel on beat selection
 *
 * IMPORTANT: This only AUTO-OPENS the panel when a beat is selected.
 * It does NOT auto-close when selection is cleared - this prevents
 * the panel from flickering during beat operations (delete, transforms)
 * that temporarily clear selection.
 *
 * The panel is closed when:
 * - User explicitly closes it (close button, swipe, etc.)
 *
 * @returns Cleanup function
 */
export function createAutoStepEditorEffect(
  config: AutoEditPanelConfig
): () => void {
  const { CreateModuleState, panelState } = config;

  let lastSelectedBeat: number | null = null;

  return $effect.root(() => {
    $effect(() => {
      // Get the sequence state fresh each time
      const seqState = CreateModuleState.sequenceState;
      const selectedStepNumber = seqState.selectedStepNumber;

      // Only act when selection CHANGES (prevents fight with manual close)
      if (selectedStepNumber !== lastSelectedBeat) {
        if (selectedStepNumber !== null) {
          // New beat selected → auto-open Beat Editor panel
          panelState.openStepEditorPanel();
          getLogger().log(
            `Auto-opening Beat Editor panel for beat ${selectedStepNumber}`
          );
        }
        // NOTE: We deliberately do NOT auto-close the panel when selection becomes null.
        // This prevents panel flickering during beat operations that temporarily clear selection.
        // The panel will be closed when the user explicitly closes it.
        lastSelectedBeat = selectedStepNumber;
      }
    });
  });
}

/**
 * @deprecated Use createAutoStepEditorEffect instead
 * Kept for backward compatibility during migration
 */
export function createAutoSequenceActionsEffect(
  config: AutoEditPanelConfig
): () => void {
  getLogger().warn(
    "createAutoSequenceActionsEffect is deprecated. Use createAutoStepEditorEffect instead."
  );
  return createAutoStepEditorEffect(config);
}

/**
 * Deprecated: Use createAutoSequenceActionsEffect instead
 * Kept for backward compatibility during migration
 * @deprecated
 */
export function createSingleBeatEditEffect(
  config: AutoEditPanelConfig
): () => void {
  getLogger().warn(
    "createSingleBeatEditEffect is deprecated. Use createAutoSequenceActionsEffect instead."
  );
  return createAutoSequenceActionsEffect(config);
}
