/**
 * Sequence Persistence Service Contract
 *
 * Service for managing sequence state persistence that survives hot module replacement.
 * This service ensures that sequence state is maintained during development and provides
 * smooth clear sequence functionality.
 */

import type { StartPositionData } from "../../domain/models/StartPositionData";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { ActiveCreateModule } from "$lib/shared/foundation/ui/UITypes";

export interface ISequencePersister {
  /**
   * Initialize the persistence service and restore any saved state
   */
  initialize(): Promise<void>;

  /**
   * Save the current sequence state for hot module replacement survival
   * @param state - Current sequence state to persist
   */
  saveCurrentState(state: {
    currentSequence: SequenceData | null;
    selectedStartPosition: StartPositionData | null;
    hasStartPosition: boolean;
    activeBuildSection: ActiveCreateModule;
  }): Promise<void>;

  /**
   * Load the current sequence state after hot module replacement
   * @param mode - Optional mode to load state for (construct, generator, assembler)
   * If not provided, loads state for the current active mode
   * @returns Saved sequence state or null if none exists
   */
  loadCurrentState(mode?: string): Promise<{
    currentSequence: SequenceData | null;
    selectedStartPosition: StartPositionData | null;
    hasStartPosition: boolean;
    activeBuildSection: ActiveCreateModule;
  } | null>;

  /**
   * Clear the current sequence state (for clear sequence functionality)
   * @param mode - Optional mode to clear state for (construct, generator, assembler)
   * If not provided, clears all modes
   */
  clearCurrentState(mode?: string): Promise<void>;

  /**
   * Check if there is a saved sequence state
   * @param mode - Optional mode to check for (construct, generator, assembler)
   * If not provided, checks the current active mode
   * @returns True if there is a saved state that can be restored
   */
  hasSavedState(mode?: string): Promise<boolean>;

  /**
   * Get the timestamp of the last saved state
   * @param mode - Optional mode to get timestamp for (construct, generator, assembler)
   * If not provided, gets timestamp for the current active mode
   * @returns Timestamp of last save or null if no state exists
   */
  getLastSaveTimestamp(mode?: string): Promise<number | null>;
}
