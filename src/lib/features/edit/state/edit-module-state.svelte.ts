/**
 * Edit Module State
 *
 * Manages state for the Edit module including:
 * - Current edit mode (beat vs sequence)
 * - Selected sequence for editing
 * - Selected beat for individual editing
 */

import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StepData } from "$lib/features/create/shared/domain/models/StepData";

export type EditMode = "beat" | "sequence";

export function createEditModuleState() {
  // Current edit mode
  let currentMode = $state<EditMode>("beat");

  // The sequence being edited
  let editingSequence = $state<SequenceData | null>(null);

  // Selected beat for individual editing (beat mode)
  let selectedStepNumber = $state<number | null>(null);
  let selectedStepData = $state<StepData | null>(null);

  // Multi-select for batch editing
  let selectedStepNumbers = $state<number[]>([]);

  // Track if sequence has unsaved changes
  let hasUnsavedChanges = $state(false);

  // Source of the sequence (for navigation back)
  let sequenceSource = $state<{
    module: string;
    returnPath?: string;
  } | null>(null);

  /**
   * Set the current edit mode
   */
  function setCurrentMode(mode: EditMode) {
    currentMode = mode;
  }

  /**
   * Load a sequence for editing
   */
  function loadSequence(
    sequence: SequenceData,
    source?: { module: string; returnPath?: string }
  ) {
    editingSequence = sequence;
    sequenceSource = source ?? null;
    hasUnsavedChanges = false;
    clearSelection();
  }

  /**
   * Clear the editing sequence
   */
  function clearSequence() {
    editingSequence = null;
    sequenceSource = null;
    hasUnsavedChanges = false;
    clearSelection();
  }

  /**
   * Select a beat for editing
   */
  function selectStep(stepNumber: number, stepData: StepData | null) {
    selectedStepNumber = stepNumber;
    selectedStepData = stepData;
    // Clear multi-select when selecting single beat
    selectedStepNumbers = [];
  }

  /**
   * Toggle beat in multi-select mode
   */
  function toggleStepInMultiSelect(stepNumber: number) {
    const index = selectedStepNumbers.indexOf(stepNumber);
    if (index === -1) {
      selectedStepNumbers = [...selectedStepNumbers, stepNumber];
    } else {
      selectedStepNumbers = selectedStepNumbers.filter((n) => n !== stepNumber);
    }
    // Clear single selection when using multi-select
    selectedStepNumber = null;
    selectedStepData = null;
  }

  /**
   * Clear beat selection
   */
  function clearSelection() {
    selectedStepNumber = null;
    selectedStepData = null;
    selectedStepNumbers = [];
  }

  /**
   * Update a beat in the editing sequence
   */
  function updateStep(stepIndex: number, updates: Partial<StepData>) {
    if (!editingSequence) return;

    const newSteps = [...editingSequence.steps];
    if (stepIndex >= 0 && stepIndex < newSteps.length) {
      const updatedStep = {
        ...newSteps[stepIndex],
        ...updates,
      } as StepData;
      newSteps[stepIndex] = updatedStep;
      editingSequence = { ...editingSequence, steps: newSteps };
      hasUnsavedChanges = true;

      // Update selected beat data if this beat is selected
      if (selectedStepNumber === stepIndex + 1) {
        selectedStepData = updatedStep;
      }
    }
  }

  /**
   * Update the start position
   */
  function updateStartPosition(updates: Partial<PictographData>) {
    if (!editingSequence?.startingPosition) return;

    editingSequence = {
      ...editingSequence,
      startingPosition: {
        ...editingSequence.startingPosition,
        ...updates,
      },
    };
    hasUnsavedChanges = true;
  }

  /**
   * Apply a transformation to the entire sequence
   */
  function transformSequence(newSequence: SequenceData) {
    editingSequence = newSequence;
    hasUnsavedChanges = true;
  }

  /**
   * Mark changes as saved
   */
  function markAsSaved() {
    hasUnsavedChanges = false;
  }

  return {
    // Getters
    get currentMode() {
      return currentMode;
    },
    get editingSequence() {
      return editingSequence;
    },
    get selectedStepNumber() {
      return selectedStepNumber;
    },
    get selectedStepData() {
      return selectedStepData;
    },
    get selectedStepNumbers() {
      return selectedStepNumbers;
    },
    get hasUnsavedChanges() {
      return hasUnsavedChanges;
    },
    get sequenceSource() {
      return sequenceSource;
    },
    get isMultiSelectMode() {
      return selectedStepNumbers.length > 0;
    },
    get hasBeatSelected() {
      return selectedStepNumber !== null || selectedStepNumbers.length > 0;
    },
    get hasSequence() {
      return editingSequence !== null;
    },

    // Actions
    setCurrentMode,
    loadSequence,
    clearSequence,
    selectStep,
    toggleStepInMultiSelect,
    clearSelection,
    updateStep,
    updateStartPosition,
    transformSequence,
    markAsSaved,
  };
}

export type EditModuleState = ReturnType<typeof createEditModuleState>;
