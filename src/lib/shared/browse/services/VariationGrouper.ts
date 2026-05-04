/**
 * Variation Grouper Implementation
 *
 * Groups sequences by their "word" to identify variations.
 * Caches results for performance and sorts variations by date (newest first).
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
export class VariationGrouper {
  // Cache for variation map to avoid recomputation
  private cachedMap: Map<string, SequenceData[]> | null = null;
  private cachedSequenceIds: Set<string> | null = null;

  groupByWord(sequences: SequenceData[]): Map<string, SequenceData[]> {
    const groups = new Map<string, SequenceData[]>();

    for (const sequence of sequences) {
      const word = this.getWord(sequence);
      if (!word) continue;

      const existing = groups.get(word);
      if (existing) {
        existing.push(sequence);
      } else {
        groups.set(word, [sequence]);
      }
    }

    // Sort each group by date (newest first)
    for (const [word, seqs] of groups) {
      groups.set(word, this.sortByDate(seqs));
    }

    return groups;
  }

  getVariationsForSequence(
    sequence: SequenceData,
    allSequences: SequenceData[]
  ): SequenceData[] {
    const map = this.getOrBuildMap(allSequences);
    const word = this.getWord(sequence);
    if (!word) return [sequence];

    return map.get(word) ?? [sequence];
  }

  getVariationCount(
    sequence: SequenceData,
    allSequences: SequenceData[]
  ): number {
    return this.getVariationsForSequence(sequence, allSequences).length;
  }

  getVariationIndex(
    sequence: SequenceData,
    allSequences: SequenceData[]
  ): number {
    const variations = this.getVariationsForSequence(sequence, allSequences);
    const index = variations.findIndex((v) => v.id === sequence.id);
    return index >= 0 ? index : 0;
  }

  buildVariationMap(sequences: SequenceData[]): Map<string, SequenceData[]> {
    this.cachedMap = this.groupByWord(sequences);
    this.cachedSequenceIds = new Set(sequences.map((s) => s.id));
    return this.cachedMap;
  }

  /**
   * Get cached map or build new one if sequences changed
   */
  private getOrBuildMap(sequences: SequenceData[]): Map<string, SequenceData[]> {
    // Check if cache is valid
    if (this.cachedMap && this.cachedSequenceIds) {
      const currentIds = new Set(sequences.map((s) => s.id));
      if (this.setsEqual(currentIds, this.cachedSequenceIds)) {
        return this.cachedMap;
      }
    }

    // Rebuild cache
    return this.buildVariationMap(sequences);
  }

  /**
   * Get the word from a sequence, normalizing for comparison
   */
  private getWord(sequence: SequenceData): string | null {
    const word = sequence.word || sequence.name;
    if (!word) return null;
    // Normalize: trim whitespace, preserve case (words are case-sensitive)
    return word.trim();
  }

  /**
   * Sort sequences by date added (newest first)
   * Falls back to name for consistent ordering
   */
  private sortByDate(sequences: SequenceData[]): SequenceData[] {
    return [...sequences].sort((a, b) => {
      // Primary: by date (newest first)
      const dateA = a.dateAdded ? new Date(a.dateAdded).getTime() : 0;
      const dateB = b.dateAdded ? new Date(b.dateAdded).getTime() : 0;
      if (dateA !== dateB) {
        return dateB - dateA; // Descending (newest first)
      }

      // Secondary: by author for consistent ordering
      const authorA = a.author ?? "";
      const authorB = b.author ?? "";
      if (authorA !== authorB) {
        return authorA.localeCompare(authorB);
      }

      // Tertiary: by ID for stable sort
      return (a.id ?? "").localeCompare(b.id ?? "");
    });
  }

  /**
   * Check if two sets are equal
   */
  private setsEqual(a: Set<string>, b: Set<string>): boolean {
    if (a.size !== b.size) return false;
    for (const item of a) {
      if (!b.has(item)) return false;
    }
    return true;
  }
}
