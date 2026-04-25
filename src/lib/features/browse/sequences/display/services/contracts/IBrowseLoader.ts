/**
 * Service for loading gallery sequences from various sources
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export interface IBrowseLoader {
  /**
   * Load all sequence metadata from the sequence index
   * (lightweight - no step data, optimized for gallery display)
   */
  loadSequenceMetadata(): Promise<SequenceData[]>;

  /**
   * Lazy-load full sequence data including steps
   * Called only when user opens a specific sequence
   * This prevents the N+1 query problem during initial gallery load
   *
   * @param sequenceName - The word/name to look up
   * @param sequenceId - Optional unique ID for disambiguation when multiple
   *   sequences share the same word (e.g. two different "FJ" variations).
   *   When provided, the ID-based lookup is preferred over word-based.
   */
  loadFullSequenceData(sequenceName: string, sequenceId?: string): Promise<SequenceData | null>;

  /**
   * Remove a single sequence from the in-memory cache.
   * Use this after a delete to update the UI instantly without a Firestore round-trip.
   */
  removeFromCache(sequenceId: string): void;

  /**
   * Add a single sequence to the in-memory cache.
   * Use this after publishing so the sequence appears in the gallery immediately
   * without requiring a Firestore round-trip.
   */
  addToCache(sequence: SequenceData): void;

  /** Populate in-memory cache from IndexedDB without triggering Firestore. */
  warmFromCache(sequences: SequenceData[], sourceRefs: Map<string, string>): void;

  /** Force a Firestore fetch regardless of cache state. Updates cache + persists to IndexedDB. */
  refreshFromFirestore(): Promise<SequenceData[]>;
}
