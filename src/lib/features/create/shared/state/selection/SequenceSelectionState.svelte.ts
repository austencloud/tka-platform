/**
 * Sequence Selection State
 *
 * Manages selection state for:
 * - Single-select mode: One beat at a time (default)
 * - Multi-select mode: Multiple beats for batch editing
 * - Selected beat NUMBER (0 = start position, 1 = first beat, 2 = second beat, etc.)
 * - Selected start position
 * - Start position editing mode
 *
 * RESPONSIBILITY: Pure selection tracking, no business logic
 *
 * NOTE: Uses beatNumber instead of array index
 * - beatNumber 0 = start position
 * - beatNumber 1 = beats[0] (first beat in array)
 * - beatNumber 2 = beats[1] (second beat in array)
 */

import type { StartPositionData } from "../../domain/models/StartPositionData";

export type SelectionMode = "single" | "multi";

export interface SequenceSelectionStateData {
  // Mode
  mode: SelectionMode; // 'single' (default) or 'multi' (batch editing)

  // Single-select (backward compatible)
  selectedBeatNumber: number | null; // 0 = start, 1 = first beat, 2 = second beat, etc.

  // Multi-select (batch editing)
  selectedBeatNumbers: Set<number>; // Multiple beat numbers for batch operations

  // Start position
  selectedStartPosition: StartPositionData | null;
  hasStartPosition: boolean;
}

export function createSequenceSelectionState() {
  const state = $state<SequenceSelectionStateData>({
    mode: "single",
    selectedBeatNumber: null,
    selectedBeatNumbers: new Set<number>(),
    selectedStartPosition: null,
    hasStartPosition: false,
  });

  return {
    // Getters
    get selectedBeatNumber() {
      return state.selectedBeatNumber;
    },

    // Legacy getter for backwards compatibility (can be removed after full refactor)
    get selectedBeatIndex() {
      // Convert beatNumber to array index: beatNumber 1 -> index 0, beatNumber 2 -> index 1, etc.
      if (state.selectedBeatNumber === null || state.selectedBeatNumber === 0) {
        return null;
      }
      return state.selectedBeatNumber - 1;
    },

    get selectedStartPosition() {
      return state.selectedStartPosition;
    },
    get hasStartPosition() {
      return state.hasStartPosition;
    },
    get isStartPositionSelected() {
      return state.selectedBeatNumber === 0;
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
    get selectedBeatNumbers() {
      return state.selectedBeatNumbers;
    },
    get selectionCount(): number {
      if (state.mode === "single") {
        return state.selectedBeatNumber !== null ? 1 : 0;
      }
      return state.selectedBeatNumbers.size;
    },
    get hasMultipleSelection(): boolean {
      return state.mode === "multi" && state.selectedBeatNumbers.size > 1;
    },

    // Computed
    get hasSelection() {
      if (state.mode === "single") {
        return state.selectedBeatNumber !== null;
      }
      return state.selectedBeatNumbers.size > 0;
    },

    // Selection operations
    selectBeat(beatNumber: number | null) {
      state.selectedBeatNumber = beatNumber;
    },

    selectStartPosition() {
      state.selectedBeatNumber = 0;
    },

    clearSelection() {
      state.selectedBeatNumber = null;
    },

    isBeatSelected(beatNumber: number): boolean {
      if (state.mode === "single") {
        return state.selectedBeatNumber === beatNumber;
      }
      return state.selectedBeatNumbers.has(beatNumber);
    },

    // Multi-select operations
    enterMultiSelectMode(initialBeatNumber: number) {
      state.mode = "multi";
      state.selectedBeatNumbers = new Set([initialBeatNumber]);
      state.selectedBeatNumber = null; // Clear single-select
    },

    exitMultiSelectMode() {
      state.mode = "single";
      state.selectedBeatNumbers = new Set<number>(); // Create new Set to trigger reactivity
      state.selectedBeatNumber = null;
    },

    toggleBeatInMultiSelect(beatNumber: number): {
      success: boolean;
      error?: string;
    } {
      if (state.mode !== "multi") {
        return { success: false, error: "Not in multi-select mode" };
      }

      // Validate: Cannot mix start position (0) with regular beats (>0)
      const hasStartPosition = state.selectedBeatNumbers.has(0);
      const hasRegularBeats = Array.from(state.selectedBeatNumbers).some(
        (n) => n > 0
      );
      const isStartPosition = beatNumber === 0;

      if (isStartPosition && hasRegularBeats) {
        return {
          success: false,
          error:
            "Cannot select start position with beats. They have different properties.",
        };
      }

      if (!isStartPosition && hasStartPosition) {
        return {
          success: false,
          error:
            "Cannot select beats with start position. They have different properties.",
        };
      }

      // Toggle selection - Create new Set to trigger Svelte 5 reactivity
      const newSet = new Set(state.selectedBeatNumbers);
      if (newSet.has(beatNumber)) {
        newSet.delete(beatNumber);
      } else {
        newSet.add(beatNumber);
      }
      state.selectedBeatNumbers = newSet;

      return { success: true };
    },

    selectAllBeats(beatNumbers: number[]) {
      if (state.mode !== "multi") {
        state.mode = "multi";
      }

      // Filter out start position if regular beats are included, and vice versa
      const hasStartPosition = beatNumbers.includes(0);
      const regularBeats = beatNumbers.filter((n) => n > 0);

      if (hasStartPosition && regularBeats.length > 0) {
        // If both types, prefer regular beats (more common use case)
        state.selectedBeatNumbers = new Set(regularBeats);
      } else {
        state.selectedBeatNumbers = new Set(beatNumbers);
      }
    },

    clearMultiSelection() {
      state.selectedBeatNumbers.clear();
    },

    // Start position management
    setStartPosition(startPosition: StartPositionData | null) {
      state.selectedStartPosition = startPosition;
      state.hasStartPosition = startPosition !== null;
    },

    // Helpers for beat removal adjustments
    adjustSelectionForRemovedBeat(removedBeatNumber: number) {
      if (state.selectedBeatNumber === removedBeatNumber) {
        state.selectedBeatNumber = null;
      } else if (
        state.selectedBeatNumber !== null &&
        state.selectedBeatNumber > removedBeatNumber
      ) {
        state.selectedBeatNumber = state.selectedBeatNumber - 1;
      }
    },

    adjustSelectionForInsertedBeat(insertedBeatNumber: number) {
      if (
        state.selectedBeatNumber !== null &&
        state.selectedBeatNumber >= insertedBeatNumber
      ) {
        state.selectedBeatNumber = state.selectedBeatNumber + 1;
      }
    },

    reset() {
      state.mode = "single";
      state.selectedBeatNumber = null;
      state.selectedBeatNumbers.clear();
      state.selectedStartPosition = null;
      state.hasStartPosition = false;
    },
  };
}

export type SequenceSelectionState = ReturnType<
  typeof createSequenceSelectionState
>;
