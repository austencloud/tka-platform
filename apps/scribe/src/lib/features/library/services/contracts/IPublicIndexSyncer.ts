/**
 * IPublicIndexSyncer - Public Sequence Index Management
 *
 * Handles syncing sequences to/from the public index (publicSequences collection).
 * When a sequence is published, it gets copied to the public index for discovery.
 * When unpublished or deleted, it gets removed from the public index.
 */

import type { LibrarySequence } from "../../domain/models/LibrarySequence";

export interface IPublicIndexSyncer {
  /**
   * Sync a public sequence to the publicSequences collection
   * Creates or updates the public index entry with denormalized data
   *
   * @param sequence The sequence to sync (must have visibility: "public")
   * @param userId The owner's user ID
   */
  syncToPublicIndex(sequence: LibrarySequence, userId: string): Promise<void>;

  /**
   * Remove a sequence from the public index
   * Called when a sequence is unpublished or deleted
   *
   * @param sequenceId The ID of the sequence to remove
   */
  removeFromPublicIndex(sequenceId: string): Promise<void>;
}
