/**
 * IGalleryOfflineCache
 *
 * Persists public gallery sequence metadata to Dexie for offline access.
 * Called by PublicSequencesLoader after a successful Firestore fetch.
 * On offline, provides cached data so the gallery renders without network.
 */

import type { PublicSequenceIndex } from "$lib/features/library/domain/models/PublicSequenceIndex";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

/** Converts a PublicSequenceIndex doc into a SequenceData for gallery display. */
export type GallerySequenceConverter = (data: PublicSequenceIndex, id: string) => SequenceData;

export interface IGalleryOfflineCache {
  /** Set the converter used by loadCached() to map PublicSequenceIndex → SequenceData. */
  setConverter(fn: GallerySequenceConverter): void;

  /** Persist raw Firestore docs to Dexie. Called after a successful fetch. */
  persist(docs: PublicSequenceIndex[]): Promise<void>;

  /** Load cached docs, returning SequenceData[] for gallery consumption. */
  loadCached(): Promise<{
    sequences: SequenceData[];
    sourceRefs: Map<string, string>;
    lastSyncedAt: number | null;
  }>;

  /** Remove all cached gallery data. */
  clear(): Promise<void>;

  /** Get cache stats for the settings panel. */
  getStats(): Promise<{ count: number; lastSyncedAt: number | null }>;

  /** Whether any cached data exists. */
  hasCachedData(): Promise<boolean>;
}
