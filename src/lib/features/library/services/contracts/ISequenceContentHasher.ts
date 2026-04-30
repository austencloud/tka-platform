/**
 * ISequenceContentHasher - Computes a deterministic hash from a sequence's motion content
 *
 * The hash captures only the fields that define what the sequence IS as a physical
 * movement pattern: turn values, motion types, locations, positions, orientations.
 * Everything else (name, tags, thumbnails, visibility) is excluded because those are
 * user annotations on top of the motion content, not the content itself.
 *
 * Two sequences with the same content hash are the same variation - even if created
 * by different users with different names. Two sequences with different hashes are
 * different variations and deserve separate documents with separate birthdays.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export interface ISequenceContentHasher {
  /**
   * Compute a SHA-256 hex digest from the motion-defining fields of a sequence.
   * Deterministic: same motion content always produces the same hash.
   */
  computeHash(sequence: SequenceData): Promise<string>;
}
