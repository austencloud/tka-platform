/**
 * SequenceDetailLoader - Load full sequence data for detail views
 *
 * Handles lazy-loading of complete sequence data (including beats)
 * when viewing sequence details. Prevents duplicate loads and
 * provides efficient caching.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { ISequenceDetailLoader } from "../contracts/ISequenceDetailLoader";
import type { IDiscoverLoader } from "../contracts/IDiscoverLoader";

export class SequenceDetailLoader implements ISequenceDetailLoader {
  // In-flight loads to prevent duplicates
  private loadPromises = new Map<string, Promise<SequenceData | null>>();

  constructor(private readonly discoverLoader: IDiscoverLoader) {}

  async loadFullSequence(sequence: SequenceData): Promise<SequenceData | null> {
    // If sequence already has beats, use it directly
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
    const loadPromise = this.discoverLoader
      .loadFullSequenceData(sequenceName)
      .finally(() => {
        // Clean up after load completes
        this.loadPromises.delete(sequenceName);
      });

    this.loadPromises.set(sequenceName, loadPromise);
    return loadPromise;
  }

  needsFullLoad(sequence: SequenceData): boolean {
    return !sequence.beats || sequence.beats.length === 0;
  }
}
