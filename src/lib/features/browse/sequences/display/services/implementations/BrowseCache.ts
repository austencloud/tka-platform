/**
 * Browse Cache Service
 *
 * Simple in-memory cache for gallery sequences.
 * Prevents redundant loading and metadata extraction operations.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
export class BrowseCache {
  private cachedSequences: SequenceData[] | null = null;

  getCached(): SequenceData[] | null {
    return this.cachedSequences;
  }

  setCached(sequences: SequenceData[]): void {
    this.cachedSequences = sequences;
  }

  clearCache(): void {
    this.cachedSequences = null;
  }
}
