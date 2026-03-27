/**
 * IDuetPersister Contract
 *
 * Service for persisting and resolving duet sequences.
 * Duets reference library sequences by ID - this service handles both
 * CRUD operations and resolution to full sequence data.
 */

import type {
  DuetSequence,
  DuetSequenceWithData,
  CreateDuetInput,
} from "../../domain/duet-sequence";

export interface IDuetPersister {
  /**
   * Save a new duet sequence
   * @returns The generated duet ID
   */
  saveDuet(input: CreateDuetInput): Promise<string>;

  /**
   * Update an existing duet
   */
  updateDuet(duet: DuetSequence): Promise<void>;

  /**
   * Get a duet by ID (without resolving sequence data)
   */
  getDuet(id: string): Promise<DuetSequence | null>;

  /**
   * Get all saved duets
   */
  getAllDuets(): Promise<DuetSequence[]>;

  /**
   * Delete a duet by ID
   */
  deleteDuet(id: string): Promise<void>;

  /**
   * Get a duet with resolved sequence data for both avatars.
   * Returns null if duet not found or if either sequence cannot be resolved.
   */
  getDuetWithData(id: string): Promise<DuetSequenceWithData | null>;

  /**
   * Resolve a duet to full sequence data.
   * Useful when you already have the duet object.
   * Returns null if either sequence cannot be resolved.
   */
  resolveDuetSequences(
    duet: DuetSequence
  ): Promise<DuetSequenceWithData | null>;
}
