/**
 * Simplified Workbench Service Interface
 *
 * Focused interface for core workbench operations.
 * Follows the same simplification pattern as OptionPickerService.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StepData } from "../../../../domain/models/StepData";
import type { StartPositionData } from "../../../../domain/models/StartPositionData";

export interface IWorkbench {
  /**
   * Handle beat click interaction
   * @param stepIndex - Index of clicked beat
   * @param sequence - Current sequence
   * @returns True if beat should be selected
   */
  handleStepClick(stepIndex: number, sequence: SequenceData | null): boolean;

  /**
   * Edit a beat with default pictograph data
   * @param stepIndex - Index of beat to edit
   * @param sequence - Current sequence
   * @returns Updated step data
   */
  editBeat(stepIndex: number, sequence: SequenceData): StepData;

  /**
   * Clear a beat (make it blank)
   * @param stepIndex - Index of beat to clear
   * @param sequence - Current sequence
   * @returns Updated step data
   */
  clearBeat(stepIndex: number, sequence: SequenceData): StepData;

  /**
   * Add a beat to a sequence
   * @param sequenceId - Sequence identifier
   * @param stepData - Optional step data
   * @returns Promise resolving to updated sequence
   */
  addStep(
    sequenceId: string,
    stepData?: Partial<StepData>
  ): Promise<SequenceData>;

  /**
   * Set construction start position
   * @param sequenceId - Sequence identifier
   * @param startPosition - Start position data
   * @returns Promise resolving to updated sequence
   */
  setConstructionStartPosition(
    sequenceId: string,
    startPosition: StartPositionData
  ): Promise<SequenceData>;

  /**
   * Validate beat operations
   * @param stepIndex - Beat index
   * @param sequence - Current sequence
   * @returns True if operation is valid
   */
  canEditBeat(stepIndex: number, sequence: SequenceData | null): boolean;
}
