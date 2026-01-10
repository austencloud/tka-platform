/**
 * Simplified Workbench State Factory
 *
 * Focused state management for core workbench operations.
 * Follows the same simplification pattern as OptionPickerState.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { BeatData } from "../../../domain/models/BeatData";
import { container } from "$lib/shared/di";
import type { IWorkbench } from "../services/contracts/IWorkbench";

/**
 * Creates simplified workbench state
 */
export function createWorkbenchState() {
  // Get the service
  const Workbench = container.items.workbench as IWorkbench;

  // Simple reactive state - just what we need
  let selectedBeatIndex = $state<number | null>(null);
  let error = $state<string | null>(null);

  // Computed values
  const hasSelection = $derived(
    selectedBeatIndex !== null && selectedBeatIndex >= 0
  );

  // ============================================================================
  // ACTIONS
  // ============================================================================

  // Handle beat click
  function handleBeatClick(
    beatIndex: number,
    sequence: SequenceData | null
  ): boolean {
    try {
      const shouldSelect = Workbench.handleBeatClick(beatIndex, sequence);
      if (shouldSelect) {
        selectedBeatIndex = beatIndex;
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
    beatIndex: number,
    sequence: SequenceData
  ): BeatData | null {
    try {
      const updatedBeat = Workbench.editBeat(beatIndex, sequence);
      error = null;
      return updatedBeat;
    } catch (err) {
      console.error("Error editing beat:", err);
      error = err instanceof Error ? err.message : "Failed to edit beat";
      return null;
    }
  }

  // Clear a beat
  function clearBeat(
    beatIndex: number,
    sequence: SequenceData
  ): BeatData | null {
    try {
      const updatedBeat = Workbench.clearBeat(beatIndex, sequence);
      error = null;
      return updatedBeat;
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
    get selectedBeatIndex() {
      return selectedBeatIndex;
    },
    get error() {
      return error;
    },
    get hasSelection() {
      return hasSelection;
    },

    // Actions
    handleBeatClick,
    editBeat,
    clearBeat,
    clearError,

    // Service access for advanced operations
    get service() {
      return Workbench;
    },
  };
}
