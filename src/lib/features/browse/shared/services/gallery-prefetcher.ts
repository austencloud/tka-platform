/**
 * GalleryPrefetcher
 *
 * Runs at app boot to warm the browse gallery's in-memory cache from IndexedDB,
 * then syncs fresh data from Firestore in the background. Subscribes to library
 * mutation events to keep the IndexedDB cache current between sessions.
 *
 * The result: when the user opens the gallery, data is already in memory.
 * No skeleton loaders. No Firestore wait.
 */

import type { PublicSequencesLoader } from "$lib/shared/browse/services/PublicSequencesLoader";
import type { GalleryOfflineCache } from "../../../../../shared/offline/services/implementations/GalleryOfflineCache";
import {
  onLibraryMutated,
  onLibrarySequenceAdded,
  onLibrarySequenceUpdated,
} from "$lib/shared/library/library-events";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { GalleryCacheEntry } from "$lib/shared/offline/domain/offline-cache-types";
import { db } from "$lib/shared/persistence/database/TKADatabase";

export class GalleryPrefetcher {
  private _isWarmed = false;
  private _isSyncing = false;
  private _prefetchPromise: Promise<void> | null = null;
  private eventCleanups: (() => void)[] = [];

  constructor(
    private readonly loader: PublicSequencesLoader,
    private readonly offlineCache: GalleryOfflineCache
  ) {}

  get isWarmed(): boolean {
    return this._isWarmed;
  }

  get isSyncing(): boolean {
    return this._isSyncing;
  }

  get prefetchPromise(): Promise<void> | null {
    return this._prefetchPromise;
  }

  async prefetch(): Promise<void> {
    if (this._prefetchPromise) return this._prefetchPromise;

    this._prefetchPromise = this.doPrefetch();
    try {
      await this._prefetchPromise;
    } finally {
      this._prefetchPromise = null;
    }
  }

  private async doPrefetch(): Promise<void> {
    // Phase 1: Warm from IndexedDB (fast - local disk)
    try {
      const hasCache = await this.offlineCache.hasCachedData();
      if (hasCache) {
        const cached = await this.offlineCache.loadCached();
        if (cached.sequences.length > 0) {
          this.loader.warmFromCache(cached.sequences, cached.sourceRefs);
          this._isWarmed = true;
        }
      }
    } catch (error) {
      console.warn("[GalleryPrefetcher] IndexedDB warm failed:", error);
    }

    // Phase 2: Background Firestore sync (non-blocking)
    this.backgroundSync();

    // Phase 3: Subscribe to mutation events for real-time IndexedDB patching
    this.subscribeToMutationEvents();
  }

  private backgroundSync(): void {
    this._isSyncing = true;

    // If we warmed from cache, loadSequenceMetadata() would just return
    // the stale cached data. Use refreshFromFirestore() to force a fresh
    // Firestore query that updates the in-memory cache and persists to IndexedDB.
    //
    // If cache was empty (first launch), this is the initial Firestore fetch.
    // Either way, the gallery gets fresh data.
    const syncPromise = this._isWarmed
      ? this.loader.refreshFromFirestore()
      : this.loader.loadSequenceMetadata();

    syncPromise
      .then(() => {
        this._isSyncing = false;
      })
      .catch((error: unknown) => {
        console.warn("[GalleryPrefetcher] Background sync failed:", error);
        this._isSyncing = false;
      });
  }

  private subscribeToMutationEvents(): void {
    // Delete: remove from IndexedDB cache
    this.eventCleanups.push(
      onLibraryMutated((sequenceId) => {
        db.galleryCache.delete(sequenceId).catch((err) =>
          console.warn("[GalleryPrefetcher] Failed to delete from cache:", err)
        );
      })
    );

    // Add: upsert into IndexedDB cache.
    // The galleryCache table stores PublicSequenceIndex-shaped data, but the
    // SequenceData from the event has compatible fields. The converter in
    // GalleryOfflineCache.loadCached() reads whatever fields are present, so
    // extra fields (like steps, isFavorite) are harmlessly ignored by the
    // gallery display layer.
    this.eventCleanups.push(
      onLibrarySequenceAdded((sequence: SequenceData) => {
        const entry: GalleryCacheEntry = {
          id: sequence.id,
          data: JSON.parse(JSON.stringify(sequence)),
          cachedAt: Date.now(),
        };
        db.galleryCache.put(entry).catch((err) =>
          console.warn("[GalleryPrefetcher] Failed to add to cache:", err)
        );
      })
    );

    // Update: merge changed fields into existing IndexedDB entry
    this.eventCleanups.push(
      onLibrarySequenceUpdated(
        (sequenceId: string, updates: Record<string, unknown>) => {
          db.galleryCache
            .get(sequenceId)
            .then((existing) => {
              if (!existing) return;
              const merged = { ...existing.data, ...updates };
              return db.galleryCache.put({
                ...existing,
                data: merged as GalleryCacheEntry["data"],
                cachedAt: Date.now(),
              });
            })
            .catch((err) =>
              console.warn(
                "[GalleryPrefetcher] Failed to update cache:",
                err
              )
            );
        }
      )
    );
  }
}
