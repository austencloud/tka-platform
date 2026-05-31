import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { BuildModeId } from "$lib/shared/foundation/ui/ui-types";
import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/start-position-data";

/**
 * SequenceTransferHandler
 */
export type TransferCheckResult =
  | { action: "transfer"; sequence: SequenceData }
  | { action: "already-loaded" }
  | { action: "confirm-needed"; pendingSequence: SequenceData };
import { areSequencesEqual } from "../utils/sequence-comparison";

/**
 * Handles transferring sequences to the Constructor tab.
 * Manages the comparison logic and state synchronization.
 */

export function checkTransfer(
  sourceSequence: SequenceData,
  targetSequence: SequenceData | null,
  targetHasSequence: boolean
): TransferCheckResult {
  // Check if sequences are identical - skip modal and just navigate
  if (targetSequence && areSequencesEqual(sourceSequence, targetSequence)) {
    return { action: "already-loaded" };
  }

  // Different sequences - need confirmation if construct has content
  if (targetHasSequence) {
    return { action: "confirm-needed", pendingSequence: sourceSequence };
  }

  // Target is empty - can transfer immediately
  return { action: "transfer", sequence: sourceSequence };
}

export async function executeTransfer(
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
): Promise<void> {
  // Deep copy to avoid mutations affecting source
  const sequenceCopy = JSON.parse(JSON.stringify(sequence)) as SequenceData;

  // Sync grid mode IMMEDIATELY before updating sequence state
  // This prevents the flicker of options disappearing and reappearing
  if (sequenceCopy.gridMode) {
    constructTabState.syncGridModeFromSequence?.(sequenceCopy.gridMode);
  }

  // Set the sequence
  constructTabState.sequenceState.setCurrentSequence(sequenceCopy);

  // Sync start position
  const startPos: StartPositionData | undefined =
    sequenceCopy.startPosition || sequenceCopy.startingPosition;
  if (startPos) {
    constructTabState.sequenceState.setStartPosition(startPos);
    constructTabState.setSelectedStartPosition(startPos);
    constructTabState.setShowStartPositionPicker(false);
  }

  // Sync picker state
  constructTabState.syncPickerStateWithSequence?.();

  // CRITICAL: Save to persistence BEFORE switching tabs!
  // Otherwise restoreStateForTab will load the OLD persisted sequence and overwrite our new one
  await constructTabState.sequenceState.saveCurrentState("construct");
}
