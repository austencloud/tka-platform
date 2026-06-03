/**
 * SequenceDetailLoader - Load full sequence data for detail views
 *
 * Handles lazy-loading of complete sequence data (including steps)
 * when viewing sequence details. Prevents duplicate loads and
 * provides efficient caching.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { PublicSequencesLoader } from "$lib/shared/browse/services/public-sequences-loader";

export class SequenceDetailLoader {
  // In-flight loads to prevent duplicates
  private loadPromises = new Map<string, Promise<SequenceData | null>>();

  constructor(private readonly browseLoader: PublicSequencesLoader) {}

  async loadFullSequence(sequence: SequenceData): Promise<SequenceData | null> {
    // If sequence already has steps, use it directly
    if (!this.needsFullLoad(sequence)) {
      return sequence;
    }

    const sequenceName = sequence.word || sequence.id;

    // Check for in-flight load
    const existing = this.loadPromises.get(sequenceName);
    if (existing) {
      return existing;
    }

    // Start new load
    const loadPromise = this.browseLoader
      .loadFullSequenceData(sequenceName)
      .finally(() => {
        // Clean up after load completes
        this.loadPromises.delete(sequenceName);
      });

    this.loadPromises.set(sequenceName, loadPromise);
    return loadPromise;
  }

  needsFullLoad(sequence: SequenceData): boolean {
    return !sequence.steps || sequence.steps.length === 0;
  }
}
