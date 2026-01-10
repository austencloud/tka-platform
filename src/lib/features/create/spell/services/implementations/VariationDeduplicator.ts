/**
 * Variation Deduplicator Implementation
 *
 * Normalizes sequences to canonical rotation and tracks seen hashes
 * to eliminate rotational duplicates.
 *
 * Two sequences that are identical when one is rotated are considered
 * duplicates. We compute a canonical hash by finding the minimum hash
 * across all 8 possible rotations (0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°).
 */

import type { IGridPositionDeriver } from "$lib/shared/pictograph/grid/services/contracts/IGridPositionDeriver";
import type { IMotionQueryHandler } from "$lib/shared/foundation/services/contracts/data/data-contracts";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { IVariationDeduplicator } from "../contracts/IVariationDeduplicator";
import { generateSequenceHash } from "$lib/features/create/shared/utils/sequence-hash";
import { rotateSequence } from "$lib/features/create/shared/services/implementations/sequence-transforms/sequence-transforms";

/** Number of rotation steps to check (8 x 45° = 360°) */
const ROTATION_STEPS = 8;

export class VariationDeduplicator implements IVariationDeduplicator {
  /** Set of canonical hashes for sequences that have been seen */
  private seenHashes = new Set<string>();

  /** Total number of sequences processed (including duplicates) */
  private totalCount = 0;

  constructor(
    private positionDeriver: IGridPositionDeriver,
    private motionQueryHandler: IMotionQueryHandler
  ) {}

  /**
   * Get the canonical hash for a sequence.
   * This is the minimum hash across all 8 possible rotations.
   * Sequences with the same canonical hash are rotationally equivalent.
   */
  async getCanonicalHash(sequence: SequenceData): Promise<string> {
    if (!sequence?.beats || sequence.beats.length === 0) {
      return "";
    }

    const hashes: string[] = [];

    // Generate hash for each rotation (0, 1, 2, 3, 4, 5, 6, 7 = 0°, 45°, 90°, ...)
    for (let rotation = 0; rotation < ROTATION_STEPS; rotation++) {
      const rotated =
        rotation === 0
          ? sequence
          : await rotateSequence(
              sequence,
              rotation,
              this.positionDeriver,
              this.motionQueryHandler
            );

      const hash = generateSequenceHash(rotated);
      hashes.push(hash);
    }

    // Return the lexicographically smallest hash as the canonical form
    return hashes.sort()[0] || "";
  }

  /**
   * Check if a sequence is a duplicate of one already seen.
   * Uses canonical hash for comparison.
   */
  async isDuplicate(sequence: SequenceData): Promise<boolean> {
    const canonicalHash = await this.getCanonicalHash(sequence);
    if (!canonicalHash) return false;

    return this.seenHashes.has(canonicalHash);
  }

  /**
   * Try to add a sequence to the seen set.
   * Returns false if the sequence is a rotational duplicate.
   */
  async tryAdd(sequence: SequenceData): Promise<boolean> {
    this.totalCount++;

    const canonicalHash = await this.getCanonicalHash(sequence);
    if (!canonicalHash) return false;

    if (this.seenHashes.has(canonicalHash)) {
      return false; // Duplicate
    }

    this.seenHashes.add(canonicalHash);
    return true; // Added successfully (was unique)
  }

  /**
   * Get the number of unique sequences seen so far.
   */
  getUniqueCount(): number {
    return this.seenHashes.size;
  }

  /**
   * Get the total number of sequences processed (including duplicates).
   */
  getTotalCount(): number {
    return this.totalCount;
  }

  /**
   * Reset the deduplicator for a new exploration run.
   */
  reset(): void {
    this.seenHashes.clear();
    this.totalCount = 0;
  }
}
