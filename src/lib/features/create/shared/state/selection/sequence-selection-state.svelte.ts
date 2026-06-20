/**
 * Sequence Selection State
 *
 * Manages selection state for:
 * - Single-select mode: One beat at a time (default)
 * - Multi-select mode: Multiple steps for batch editing
 * - Selected beat NUMBER (0 = start position, 1 = first beat, 2 = second beat, etc.)
 * - Selected start position
 * - Start position editing mode
 *
 * RESPONSIBILITY: Pure selection tracking, no business logic
 *
 * NOTE: Uses stepNumber instead of array index
 * - stepNumber 0 = start position
 * - stepNumber 1 = steps[0] (first beat in array)
 * - stepNumber 2 = steps[1] (second beat in array)
 */

import type { StartPositionData } from "$lib/shared/foundation/domain/models/start-position-data";
import { createPersistenceHelper } from "$lib/shared/state/utils/persistent-state";

export type SelectionMode = "single" | "multi";

// Persist only the single-select step number. The step editor + inspect modal
// hang off this, so restoring it across a dev HMR / page refresh lets them
// reopen on the right step instead of empty. Multi-select sets stay transient.
const selectionPersistence = createPersistenceHelper<number | null>({
  key: "tka_selected_step_number",
  defaultValue: null,
});

export interface SequenceSelectionStateData {
  // Mode
  mode: SelectionMode; // 'single' (default) or 'multi' (batch editing)

  // Single-select (backward compatible)
  selectedStepNumber: number | null; // 0 = start, 1 = first beat, 2 = second beat, etc.

  // Multi-select (batch editing)
  selectedStepNumbers: Set<number>; // Multiple beat numbers for batch operations

  // Start position
  selectedStartPosition: StartPositionData | null;
  hasStartPosition: boolean;
}

export function createSequenceSelectionState() {
  const state = $state<SequenceSelectionStateData>({
    mode: "single",
    selectedStepNumber: selectionPersistence.load(),
    selectedStepNumbers: new Set<number>(),
    selectedStartPosition: null,
    hasStartPosition: false,
  });

  // Auto-save the selected step number so HMR / refresh restores it.
  $effect.root(() => {
    $effect(() => {
      void state.selectedStepNumber;
      selectionPersistence.setupAutoSave(state.selectedStepNumber);
    });
  });

  return {
    // Getters
    get selectedStepNumber() {
      return state.selectedStepNumber;
    },

    // Legacy getter for backwards compatibility (can be removed after full refactor)
    get selectedStepIndex() {
      // Convert stepNumber to array index: stepNumber 1 -> index 0, stepNumber 2 -> index 1, etc.
      if (state.selectedStepNumber === null || state.selectedStepNumber === 0) {
        return null;
      }
      return state.selectedStepNumber - 1;
    },

    get selectedStartPosition() {
      return state.selectedStartPosition;
    },
    get hasStartPosition() {
      return state.hasStartPosition;
    },
    get isStartPositionSelected() {
      return state.selectedStepNumber === 0;
    },

    // Mode getters
    get mode() {
      return state.mode;
    },
    get isMultiSelectMode() {
      return state.mode === "multi";
    },
    get isSingleSelectMode() {
      return state.mode === "single";
    },

    // Multi-select getters
    get selectedStepNumbers() {
      return state.selectedStepNumbers;
    },
    get selectionCount(): number {
      if (state.mode === "single") {
        return state.selectedStepNumber !== null ? 1 : 0;
      }
      return state.selectedStepNumbers.size;
    },
    get hasMultipleSelection(): boolean {
      return state.mode === "multi" && state.selectedStepNumbers.size > 1;
    },

    // Computed
    get hasSelection() {
      if (state.mode === "single") {
        return state.selectedStepNumber !== null;
      }
      return state.selectedStepNumbers.size > 0;
    },

    // Selection operations
    selectStep(stepNumber: number | null) {
      state.selectedStepNumber = stepNumber;
    },

    selectStartPosition() {
      state.selectedStepNumber = 0;
    },

    clearSelection() {
      state.selectedStepNumber = null;
    },

    isStepSelected(stepNumber: number): boolean {
      if (state.mode === "single") {
        return state.selectedStepNumber === stepNumber;
      }
      return state.selectedStepNumbers.has(stepNumber);
    },

    // Multi-select operations
    enterMultiSelectMode(initialStepNumber: number) {
      state.mode = "multi";
      state.selectedStepNumbers = new Set([initialStepNumber]);
      state.selectedStepNumber = null; // Clear single-select
    },

    exitMultiSelectMode() {
      state.mode = "single";
      state.selectedStepNumbers = new Set<number>(); // Create new Set to trigger reactivity
      state.selectedStepNumber = null;
    },

    toggleStepInMultiSelect(stepNumber: number): {
      success: boolean;
      error?: string;
    } {
      if (state.mode !== "multi") {
        return { success: false, error: "Not in multi-select mode" };
      }

      // Validate: Cannot mix start position (0) with regular steps (>0)
      const hasStartPosition = state.selectedStepNumbers.has(0);
      const hasRegularBeats = Array.from(state.selectedStepNumbers).some(
        (n) => n > 0
      );
      const isStartPosition = stepNumber === 0;

      if (isStartPosition && hasRegularBeats) {
        return {
          success: false,
          error:
            "Cannot select start position with steps. They have different properties.",
        };
      }

      if (!isStartPosition && hasStartPosition) {
        return {
          success: false,
          error:
            "Cannot select steps with start position. They have different properties.",
        };
      }

      // Toggle selection - Create new Set to trigger Svelte 5 reactivity
      const newSet = new Set(state.selectedStepNumbers);
      if (newSet.has(stepNumber)) {
        newSet.delete(stepNumber);
      } else {
        newSet.add(stepNumber);
      }
      state.selectedStepNumbers = newSet;

      return { success: true };
    },

    selectAllBeats(stepNumbers: number[]) {
      if (state.mode !== "multi") {
        state.mode = "multi";
      }

      // Filter out start position if regular steps are included, and vice versa
      const hasStartPosition = stepNumbers.includes(0);
      const regularBeats = stepNumbers.filter((n) => n > 0);

      if (hasStartPosition && regularBeats.length > 0) {
        // If both types, prefer regular steps (more common use case)
        state.selectedStepNumbers = new Set(regularBeats);
      } else {
        state.selectedStepNumbers = new Set(stepNumbers);
      }
    },

    clearMultiSelection() {
      state.selectedStepNumbers.clear();
    },

    // Start position management
    setStartPosition(startPosition: StartPositionData | null) {
      state.selectedStartPosition = startPosition;
      state.hasStartPosition = startPosition !== null;
    },

    // Helpers for beat removal adjustments
    adjustSelectionForRemovedStep(removedStepNumber: number) {
      if (state.selectedStepNumber === removedStepNumber) {
        state.selectedStepNumber = null;
      } else if (
        state.selectedStepNumber !== null &&
        state.selectedStepNumber > removedStepNumber
      ) {
        state.selectedStepNumber = state.selectedStepNumber - 1;
      }
    },

    adjustSelectionForInsertedStep(insertedStepNumber: number) {
      if (
        state.selectedStepNumber !== null &&
        state.selectedStepNumber >= insertedStepNumber
      ) {
        state.selectedStepNumber = state.selectedStepNumber + 1;
      }
    },

    reset() {
      state.mode = "single";
      state.selectedStepNumber = null;
      state.selectedStepNumbers.clear();
      state.selectedStartPosition = null;
      state.hasStartPosition = false;
    },
  };
}

export type SequenceSelectionState = ReturnType<
  typeof createSequenceSelectionState
>;
