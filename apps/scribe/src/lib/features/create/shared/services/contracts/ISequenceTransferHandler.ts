/**
 * ISequenceTransferHandler
 *
 * Handles transferring sequences between Create module tabs.
 * Primary use case: Edit in Constructor from Generator/Assembler.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { BuildModeId } from "$lib/shared/foundation/ui/UITypes";
import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { StartPositionData } from "../../domain/models/StartPositionData";

export type TransferCheckResult =
  | { action: "transfer"; sequence: SequenceData }
  | { action: "already-loaded" }
  | { action: "confirm-needed"; pendingSequence: SequenceData };

export interface ISequenceTransferHandler {
  /**
   * Check if a transfer is needed and what action to take.
   *
   * @returns
   * - 'already-loaded': Target already has the same sequence
   * - 'transfer': Can transfer immediately (target is empty)
   * - 'confirm-needed': Target has different sequence, needs confirmation
   */
  checkTransfer(
    sourceSequence: SequenceData,
    targetSequence: SequenceData | null,
    targetHasSequence: boolean
  ): TransferCheckResult;

  /**
   * Perform the actual transfer to construct tab.
   * Call this after confirmation (or immediately if checkTransfer returned 'transfer').
   */
  executeTransfer(
    sequence: SequenceData,
    constructTabState: {
      sequenceState: {
        setCurrentSequence: (seq: SequenceData) => void;
        setStartPosition: (pos: StartPositionData | null) => void;
        saveCurrentState: (tab: BuildModeId) => Promise<void>;
      };
      syncGridModeFromSequence?: (mode: GridMode | undefined) => void;
      setSelectedStartPosition: (pos: StartPositionData | null) => void;
      setShowStartPositionPicker: (show: boolean) => void;
      syncPickerStateWithSequence?: () => void;
    }
  ): Promise<void>;
}
