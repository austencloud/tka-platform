/**
 * Simplified Workbench Service Interface
 *
 * Focused interface for core workbench operations.
 * Follows the same simplification pattern as OptionPickerService.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { BeatData } from "../../../../domain/models/BeatData";
import type { StartPositionData } from "../../../../domain/models/StartPositionData";

export interface IWorkbench {
  /**
   * Handle beat click interaction
   * @param beatIndex - Index of clicked beat
   * @param sequence - Current sequence
   * @returns True if beat should be selected
   */
  handleBeatClick(beatIndex: number, sequence: SequenceData | null): boolean;

  /**
   * Edit a beat with default pictograph data
   * @param beatIndex - Index of beat to edit
   * @param sequence - Current sequence
   * @returns Updated beat data
   */
  editBeat(beatIndex: number, sequence: SequenceData): BeatData;

  /**
   * Clear a beat (make it blank)
   * @param beatIndex - Index of beat to clear
   * @param sequence - Current sequence
   * @returns Updated beat data
   */
  clearBeat(beatIndex: number, sequence: SequenceData): BeatData;

  /**
   * Add a beat to a sequence
   * @param sequenceId - Sequence identifier
   * @param beatData - Optional beat data
   * @returns Promise resolving to updated sequence
   */
  addBeat(
    sequenceId: string,
    beatData?: Partial<BeatData>
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
   * @param beatIndex - Beat index
   * @param sequence - Current sequence
   * @returns True if operation is valid
   */
  canEditBeat(beatIndex: number, sequence: SequenceData | null): boolean;
}
