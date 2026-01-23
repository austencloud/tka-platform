/**
 * Variation Grouper Contract
 *
 * Groups sequences by their "word" to identify variations.
 * Multiple sequences can share the same word but have different
 * authors, props, turns, or dates.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export interface VariationGroup {
  word: string;
  sequences: SequenceData[];
  count: number;
}

export interface IVariationGrouper {
  /**
   * Group all sequences by their word
   * Returns a map where key is the word and value is array of sequences
   */
  groupByWord(sequences: SequenceData[]): Map<string, SequenceData[]>;

  /**
   * Get all variations for a specific sequence
   * Returns array including the sequence itself
   */
  getVariationsForSequence(
    sequence: SequenceData,
    allSequences: SequenceData[]
  ): SequenceData[];

  /**
   * Get the count of variations for a sequence
   */
  getVariationCount(
    sequence: SequenceData,
    allSequences: SequenceData[]
  ): number;

  /**
   * Get the index of a sequence within its variation group
   * Returns 0-based index
   */
  getVariationIndex(
    sequence: SequenceData,
    allSequences: SequenceData[]
  ): number;

  /**
   * Build a lookup map for fast variation access
   * Call once when sequences change, then use for individual lookups
   */
  buildVariationMap(sequences: SequenceData[]): Map<string, SequenceData[]>;
}
