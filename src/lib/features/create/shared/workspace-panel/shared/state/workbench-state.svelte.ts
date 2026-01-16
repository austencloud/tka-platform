/**
 * Simplified Workbench State Factory
 *
 * Focused state management for core workbench operations.
 * Follows the same simplification pattern as OptionPickerState.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StepData } from "../../../domain/models/StepData";
import { container } from "$lib/shared/di";
import type { IWorkbench } from "../services/contracts/IWorkbench";

/**
 * Creates simplified workbench state
 */
export function createWorkbenchState() {
  // Get the service
  const Workbench = container.items.workbench as IWorkbench;

  // Simple reactive state - just what we need
  let selectedStepIndex = $state<number | null>(null);
  let error = $state<string | null>(null);

  // Computed values
  const hasSelection = $derived(
    selectedStepIndex !== null && selectedStepIndex >= 0
  );

  // ============================================================================
  // ACTIONS
  // ============================================================================

  // Handle beat click
  function handleStepClick(
    stepIndex: number,
    sequence: SequenceData | null
  ): boolean {
    try {
      const shouldSelect = Workbench.handleStepClick(stepIndex, sequence);
      if (shouldSelect) {
        selectedStepIndex = stepIndex;
      }
      return shouldSelect;
    } catch (err) {
      console.error("Error handling beat click:", err);
      error =
        err instanceof Error ? err.message : "Failed to handle beat click";
      return false;
    }
  }

  // Edit a beat
  function editBeat(
    stepIndex: number,
    sequence: SequenceData
  ): StepData | null {
    try {
      const updatedStep = Workbench.editBeat(stepIndex, sequence);
      error = null;
      return updatedStep;
    } catch (err) {
      console.error("Error editing beat:", err);
      error = err instanceof Error ? err.message : "Failed to edit beat";
      return null;
    }
  }

  // Clear a beat
  function clearBeat(
    stepIndex: number,
    sequence: SequenceData
  ): StepData | null {
    try {
      const updatedStep = Workbench.clearBeat(stepIndex, sequence);
      error = null;
      return updatedStep;
    } catch (err) {
      console.error("Error clearing beat:", err);
      error = err instanceof Error ? err.message : "Failed to clear beat";
      return null;
    }
  }

  // Clear error
  function clearError() {
    error = null;
  }

  // ============================================================================
  // RETURN STATE OBJECT
  // ============================================================================

  return {
    // State getters
    get selectedStepIndex() {
      return selectedStepIndex;
    },
    get error() {
      return error;
    },
    get hasSelection() {
      return hasSelection;
    },

    // Actions
    handleStepClick,
    editBeat,
    clearBeat,
    clearError,

    // Service access for advanced operations
    get service() {
      return Workbench;
    },
  };
}
