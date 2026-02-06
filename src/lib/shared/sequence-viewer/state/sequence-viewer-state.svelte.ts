/**
 * Sequence Viewer State Factory
 *
 * Svelte 5 runes-based state management for the standalone Sequence Viewer.
 * Manages sequence data, beat selection, edit panel state, and variations.
 */

import type { SequenceData } from "../../foundation/domain/models/SequenceData";
import type { StepData } from "$lib/features/create/shared/domain/models/StepData";

/**
 * State interface for the Sequence Viewer
 */
export interface SequenceViewerState {
  // Core sequence state
  readonly sequence: SequenceData | null;
  readonly isLoading: boolean;
  readonly error: string | null;

  // Edit panel state
  readonly isEditPanelOpen: boolean;
  readonly selectedStepIndex: number | null;
  readonly selectedStepData: StepData | null;

  // Variation navigation (thumbnails)
  readonly currentVariationIndex: number;
  readonly totalVariations: number;
  readonly hasMultipleVariations: boolean;

  // Layout state
  readonly isSideBySide: boolean;

  // Actions
  setSequence(sequence: SequenceData | null): void;
  updateSequence(updates: Partial<SequenceData>): void;
  setLoading(loading: boolean): void;
  setError(error: string | null): void;

  selectStep(stepIndex: number, stepData: StepData): void;
  clearSelection(): void;

  openEditPanel(): void;
  closeEditPanel(): void;

  setVariationIndex(index: number): void;
  nextVariation(): void;
  previousVariation(): void;

  setLayoutMode(isSideBySide: boolean): void;
}

/**
 * Creates a reactive state factory for the Sequence Viewer
 */
export function createSequenceViewerState(): SequenceViewerState {
  // Core state
  let sequence = $state<SequenceData | null>(null);
  let isLoading = $state(false);
  let error = $state<string | null>(null);

  // Edit panel state
  let isEditPanelOpen = $state(false);
  let selectedStepIndex = $state<number | null>(null);
  let selectedStepData = $state<StepData | null>(null);

  // Variation state
  let currentVariationIndex = $state(0);

  // Layout state
  let isSideBySide = $state(false);

  // Derived values
  const totalVariations = $derived(sequence?.thumbnails?.length ?? 1);
  const hasMultipleVariations = $derived(totalVariations > 1);

  return {
    // Getters
    get sequence() {
      return sequence;
    },
    get isLoading() {
      return isLoading;
    },
    get error() {
      return error;
    },
    get isEditPanelOpen() {
      return isEditPanelOpen;
    },
    get selectedStepIndex() {
      return selectedStepIndex;
    },
    get selectedStepData() {
      return selectedStepData;
    },
    get currentVariationIndex() {
      return currentVariationIndex;
    },
    get totalVariations() {
      return totalVariations;
    },
    get hasMultipleVariations() {
      return hasMultipleVariations;
    },
    get isSideBySide() {
      return isSideBySide;
    },

    // Sequence actions
    setSequence(seq) {
      sequence = seq;
      currentVariationIndex = 0; // Reset on new sequence
      error = null;
    },

    updateSequence(updates) {
      if (!sequence) return;
      sequence = { ...sequence, ...updates };
    },

    setLoading(loading) {
      isLoading = loading;
    },

    setError(err) {
      error = err;
      isLoading = false;
    },

    // Selection actions
    selectStep(stepIndex, stepData) {
      selectedStepIndex = stepIndex;
      selectedStepData = stepData;
    },

    clearSelection() {
      selectedStepIndex = null;
      selectedStepData = null;
    },

    // Edit panel actions
    openEditPanel() {
      if (selectedStepIndex !== null && selectedStepData !== null) {
        isEditPanelOpen = true;
      }
    },

    closeEditPanel() {
      isEditPanelOpen = false;
    },

    // Variation navigation
    setVariationIndex(index) {
      if (index >= 0 && index < totalVariations) {
        currentVariationIndex = index;
      }
    },

    nextVariation() {
      if (currentVariationIndex < totalVariations - 1) {
        currentVariationIndex++;
      }
    },

    previousVariation() {
      if (currentVariationIndex > 0) {
        currentVariationIndex--;
      }
    },

    // Layout
    setLayoutMode(sideBySide) {
      isSideBySide = sideBySide;
    },
  };
}
