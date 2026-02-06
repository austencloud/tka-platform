/**
 * Sequence Canonicalizer Contract
 *
 * Converts sequences to canonical form for efficient comparison and hashing.
 * Uses Booth's algorithm concepts for lexicographically minimal rotation.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { SequenceSignature } from "../../domain/models/signatures";

/**
 * A sequence in canonical (normalized) form.
 */
export interface CanonicalSequence {
  /** The canonicalized sequence data */
  readonly sequence: SequenceData;

  /** Number of 45° spatial rotation steps applied to reach canonical form (0-7) */
  readonly spatialRotationApplied: number;

  /** Number of beat positions shifted for circular sequences (0 to length-1) */
  readonly circularOffsetApplied: number;

  /** Hash for quick comparison */
  readonly canonicalHash: string;

  /** Full signature with beat-level detail */
  readonly signature: SequenceSignature;
}

export interface ISequenceCanonicalizer {
  /**
   * Convert sequence to canonical (normalized) form.
   *
   * For circular sequences, finds the lexicographically smallest rotation.
   * For all sequences, normalizes to a canonical spatial orientation.
   *
   * Two equivalent sequences will have the same canonical form.
   *
   * @param sequence - The sequence to canonicalize
   * @returns The canonical form with metadata about transforms applied
   */
  canonicalize(sequence: SequenceData): CanonicalSequence;

  /**
   * Generate canonical hash without full canonicalization.
   *
   * This is faster than full canonicalization when you only need
   * to check for potential duplicates.
   *
   * @param sequence - The sequence to hash
   * @returns A hash string that is identical for equivalent sequences
   */
  generateHash(sequence: SequenceData): string;

  /**
   * Check if two sequences have the same canonical form.
   *
   * This is equivalent to:
   *   canonicalize(a).canonicalHash === canonicalize(b).canonicalHash
   *
   * But may be optimized to avoid full canonicalization.
   *
   * @param seqA - First sequence
   * @param seqB - Second sequence
   * @returns true if sequences are canonically equivalent
   */
  haveSameCanonicalForm(seqA: SequenceData, seqB: SequenceData): boolean;

  /**
   * Generate a sequence signature (rotation-invariant representation).
   *
   * @param sequence - The sequence to generate signature for
   * @returns The signature with beat-level signatures and hash
   */
  generateSignature(sequence: SequenceData): SequenceSignature;
}
