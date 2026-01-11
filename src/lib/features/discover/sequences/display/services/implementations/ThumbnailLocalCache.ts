/**
 * ThumbnailLocalCache
 *
 * IndexedDB-based local cache for ALL thumbnails (unified system).
 * Uses the hash key from ThumbnailKeyDeriver which already encodes:
 * - Sequence name, prop config (single or cat-dog), light/dark, variant, settings
 *
 * This is Tier 2 in the 4-tier hierarchy:
 * 1. Static bundled (instant, shared)
 * 2. Local IndexedDB (instant, personalized) ← THIS
 * 3. Cloud cache (fast, shared)
 * 4. Local render (slow)
 */

import { browser } from "$app/environment";
import type {
  IThumbnailLocalCache,
  ThumbnailLocalCacheStats,
} from "../contracts/IThumbnailLocalCache";

const DB_NAME = "thumbnail-local-cache";
const STORE_NAME = "thumbnails";
const DB_VERSION = 1;
const DEFAULT_MAX_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB default limit

interface CachedEntry {
  /** Hash key from ThumbnailKeyDeriver */
  key: string;
  /** Thumbnail blob (webp) */
  blob: Blob;
  /** Timestamp for LRU eviction */
  timestamp: number;
  /** Size for tracking */
  sizeBytes: number;
}

export class ThumbnailLocalCache implements IThumbnailLocalCache {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private maxSizeBytes: number;

  constructor(maxSizeBytes: number = DEFAULT_MAX_SIZE_BYTES) {
    this.maxSizeBytes = maxSizeBytes;
  }

  private getDB(): Promise<IDBDatabase> {
    if (!browser) {
      return Promise.reject(new Error("IndexedDB not available on server"));
    }

    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "key" });
          store.createIndex("timestamp", "timestamp", { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
    });

    return this.dbPromise;
  }

  async get(key: string): Promise<Blob | null> {
    if (!browser) return null;

    try {
      const db = await this.getDB();
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);

      return new Promise((resolve, reject) => {
        const request = store.get(key);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const result = request.result as CachedEntry | undefined;
          if (result) {
            // Update timestamp on access (LRU)
            result.timestamp = Date.now();
            store.put(result);
            resolve(result.blob);
          } else {
            resolve(null);
          }
        };
      });
    } catch (error) {
      console.warn("[ThumbnailLocalCache] get failed:", error);
      return null;
    }
  }

  async set(key: string, blob: Blob): Promise<void> {
    if (!browser) return;

    try {
      const db = await this.getDB();
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);

      const entry: CachedEntry = {
        key,
        blob,
        timestamp: Date.now(),
        sizeBytes: blob.size,
      };

      await new Promise<void>((resolve, reject) => {
        const request = store.put(entry);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });

      // Auto-prune if over limit (async, non-blocking)
      this.prune(this.maxSizeBytes).catch(() => {});
    } catch (error) {
      console.warn("[ThumbnailLocalCache] set failed:", error);
    }
  }

  async has(key: string): Promise<boolean> {
    if (!browser) return false;

    try {
      const db = await this.getDB();
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);

      return new Promise((resolve, reject) => {
        const request = store.count(IDBKeyRange.only(key));
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result > 0);
      });
    } catch (error) {
      console.warn("[ThumbnailLocalCache] has failed:", error);
      return false;
    }
  }

  async clear(): Promise<void> {
    if (!browser) return;

    try {
      const db = await this.getDB();
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);

      return new Promise((resolve, reject) => {
        const request = store.clear();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    } catch (error) {
      console.warn("[ThumbnailLocalCache] clear failed:", error);
    }
  }

  async getStats(): Promise<ThumbnailLocalCacheStats> {
    if (!browser) return { count: 0, sizeBytes: 0 };

    try {
      const db = await this.getDB();
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);

      return new Promise((resolve, reject) => {
        const request = store.openCursor();
        let count = 0;
        let sizeBytes = 0;

        request.onerror = () => reject(request.error);
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            count++;
            const entry = cursor.value as CachedEntry;
            sizeBytes += entry.sizeBytes;
            cursor.continue();
          } else {
            resolve({ count, sizeBytes });
          }
        };
      });
    } catch (error) {
      console.warn("[ThumbnailLocalCache] getStats failed:", error);
      return { count: 0, sizeBytes: 0 };
    }
  }

  async prune(maxSizeBytes: number): Promise<number> {
    if (!browser) return 0;

    try {
      const stats = await this.getStats();
      if (stats.sizeBytes <= maxSizeBytes) return 0;

      const db = await this.getDB();
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const index = store.index("timestamp");

      // Get all entries sorted by timestamp (oldest first)
      const entries: Array<{ key: string; size: number }> = [];

      await new Promise<void>((resolve, reject) => {
        const request = index.openCursor();
        request.onerror = () => reject(request.error);
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            const entry = cursor.value as CachedEntry;
            entries.push({ key: entry.key, size: entry.sizeBytes });
            cursor.continue();
          } else {
            resolve();
          }
        };
      });

      // Delete oldest entries until under limit
      let currentSize = stats.sizeBytes;
      let deletedCount = 0;

      for (const entry of entries) {
        if (currentSize <= maxSizeBytes) break;

        await new Promise<void>((resolve, reject) => {
          const request = store.delete(entry.key);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve();
        });

        currentSize -= entry.size;
        deletedCount++;
      }

      if (deletedCount > 0) {
        console.log(`[ThumbnailLocalCache] Pruned ${deletedCount} entries (freed ${((stats.sizeBytes - currentSize) / 1024 / 1024).toFixed(1)} MB)`);
      }

      return deletedCount;
    } catch (error) {
      console.warn("[ThumbnailLocalCache] prune failed:", error);
      return 0;
    }
  }
}
