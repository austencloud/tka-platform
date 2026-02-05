/**
 * Service for managing sequence beat and start position selection
 */
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StepData } from "../../domain/models/StepData";

export interface ISequenceSelector {
  /**
   * Set the selected beat index
   */
  setSelectedBeat(
    sequenceData: SequenceData | null,
    index: number | null
  ): boolean;

  /**
   * Clear all selections
   */
  clearSelection(): void;

  /**
   * Check if a beat index is valid for the given sequence
   */
  isValidStepIndex(sequenceData: SequenceData | null, index: number): boolean;

  /**
   * Select the start position for editing
   */
  selectStartPositionForEditing(): void;

  /**
   * Check if the given beat index is selected
   */
  isBeatSelected(selectedIndex: number | null, targetIndex: number): boolean;

  /**
   * Get beat data by index, handling selection logic
   */
  getSelectedStepData(
    sequenceData: SequenceData | null,
    selectedStepIndex: number | null,
    selectedStartPosition: PictographData | null,
    isStartPositionSelected: boolean
  ): StepData | null;

  /**
   * Get beat at specific index
   */
  getStep(sequenceData: SequenceData | null, index: number): StepData | null;
}
