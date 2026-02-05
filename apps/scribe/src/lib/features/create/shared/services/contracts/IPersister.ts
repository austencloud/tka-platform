/**
 * Persistence Service Contract
 *
 * Service for data persistence operations
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export interface IPersistenceService {
  /**
   * Save a sequence to persistent storage
   * @param sequence - Sequence to save
   * @returns Promise that resolves when save is complete
   */
  saveSequence(sequence: SequenceData): Promise<void>;

  /**
   * Load a sequence from persistent storage
   * @param id - Sequence identifier
   * @returns Promise resolving to sequence data or null if not found
   */
  loadSequence(id: string): Promise<SequenceData | null>;

  /**
   * Delete a sequence from persistent storage
   * @param id - Sequence identifier
   * @returns Promise that resolves when deletion is complete
   */
  deleteSequence(id: string): Promise<void>;

  /**
   * Load all sequences from persistent storage
   * @returns Promise resolving to array of all sequences
   */
  loadAllSequences(): Promise<SequenceData[]>;
}
