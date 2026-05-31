/**
 * GalleryOfflineCache
 *
 * Persists PublicSequenceIndex documents to Dexie's galleryCache table.
 * On loadCached(), converts back to SequenceData[] via the same mapping
 * that PublicSequencesLoader uses for online data.
 */

import { db } from "$lib/shared/persistence/database/tka-database";
import type { GallerySequenceConverter } from "./types";
import type { PublicSequenceIndex } from "$lib/shared/foundation/domain/models/public-sequence-index";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { GalleryCacheEntry } from "../domain/offline-cache-types";

export class GalleryOfflineCache {
  private converter: GallerySequenceConverter | null = null;

  setConverter(fn: GallerySequenceConverter): void {
    this.converter = fn;
  }

  async persist(docs: PublicSequenceIndex[]): Promise<void> {
    const now = Date.now();
    // JSON round-trip strips non-cloneable Firestore objects (Timestamps, etc.)
    // that IndexedDB's structured clone algorithm rejects.
    const entries: GalleryCacheEntry[] = docs.map((doc) => ({
      id: doc.id,
      data: JSON.parse(JSON.stringify(doc)),
      cachedAt: now,
    }));

    await db.transaction("rw", [db.galleryCache, db.galleryCacheMeta], async () => {
      await db.galleryCache.clear();
      await db.galleryCache.bulkPut(entries);

      await db.galleryCacheMeta.put({
        id: "gallery-cache-meta",
        lastSyncedAt: now,
        sequenceCount: docs.length,
      });
    });
  }

  async loadCached(): Promise<{
    sequences: SequenceData[];
    sourceRefs: Map<string, string>;
    lastSyncedAt: number | null;
  }> {
    const [entries, meta] = await Promise.all([
      db.galleryCache.toArray(),
      db.galleryCacheMeta.get("gallery-cache-meta"),
    ]);

    if (entries.length === 0) {
      return { sequences: [], sourceRefs: new Map(), lastSyncedAt: null };
    }

    const sourceRefs = new Map<string, string>();
    const sequences: SequenceData[] = [];

    for (const entry of entries) {
      const doc = entry.data;

      if (doc.sourceRef) {
        sourceRefs.set(doc.word, doc.sourceRef);
        if (doc.name && doc.name !== doc.word) {
          sourceRefs.set(doc.name, doc.sourceRef);
        }
      }

      if (this.converter) {
        sequences.push(this.converter(doc, entry.id));
      }
    }

    return {
      sequences,
      sourceRefs,
      lastSyncedAt: meta?.lastSyncedAt ?? null,
    };
  }

  async clear(): Promise<void> {
    await db.transaction("rw", [db.galleryCache, db.galleryCacheMeta], async () => {
      await db.galleryCache.clear();
      await db.galleryCacheMeta.clear();
    });
  }

  async getStats(): Promise<{ count: number; lastSyncedAt: number | null }> {
    const [count, meta] = await Promise.all([
      db.galleryCache.count(),
      db.galleryCacheMeta.get("gallery-cache-meta"),
    ]);
    return { count, lastSyncedAt: meta?.lastSyncedAt ?? null };
  }

  async hasCachedData(): Promise<boolean> {
    const count = await db.galleryCache.count();
    return count > 0;
  }
}
