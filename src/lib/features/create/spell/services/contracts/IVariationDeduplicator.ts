/**
 * Variation Deduplicator Interface
 *
 * Normalizes sequences to canonical rotation and tracks seen hashes
 * to eliminate rotational duplicates.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

/**
 * Service that detects and eliminates rotational equivalents.
 * Two sequences that are identical when one is rotated are considered duplicates.
 */
export interface IVariationDeduplicator {
  /**
   * Get the canonical hash for a sequence.
   * This is the minimum hash across all 8 possible rotations (0°, 45°, 90°, ... 315°).
   * Sequences with the same canonical hash are rotationally equivalent.
   *
   * @param sequence - The sequence to normalize
   * @returns Promise resolving to canonical hash string
   */
  getCanonicalHash(sequence: SequenceData): Promise<string>;

  /**
   * Check if a sequence is a duplicate of one already seen.
   * Uses canonical hash for comparison.
   *
   * @param sequence - The sequence to check
   * @returns Promise resolving to true if a rotationally equivalent sequence was already seen
   */
  isDuplicate(sequence: SequenceData): Promise<boolean>;

  /**
   * Try to add a sequence to the seen set.
   * Returns false if the sequence is a rotational duplicate.
   *
   * @param sequence - The sequence to add
   * @returns Promise resolving to true if added (was unique), false if duplicate
   */
  tryAdd(sequence: SequenceData): Promise<boolean>;

  /**
   * Get the number of unique sequences seen so far.
   */
  getUniqueCount(): number;

  /**
   * Get the total number of sequences processed (including duplicates).
   */
  getTotalCount(): number;

  /**
   * Reset the deduplicator for a new exploration run.
   */
  reset(): void;
}
