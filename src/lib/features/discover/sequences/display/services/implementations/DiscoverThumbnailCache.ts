/**
 * Thumbnail Cache Implementation
 *
 * Uses IndexedDB to cache rendered thumbnails for cat-dog mode.
 * Handles mixed-prop configurations where pre-rendered images don't exist.
 */

import { injectable } from "inversify";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type {
  IDiscoverThumbnailCache,
  ThumbnailCacheKey,
  CachedThumbnail,
} from "../contracts/IDiscoverThumbnailCache";

const DB_NAME = "discover-thumbnail-cache";
const STORE_NAME = "thumbnails";
const DB_VERSION = 1;

@injectable()
export class DiscoverThumbnailCache implements IDiscoverThumbnailCache {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
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

  private buildKey(key: ThumbnailCacheKey): string {
    return `${key.sequenceName}|${key.bluePropType}|${key.redPropType}|${key.lightMode}`;
  }

  async get(key: ThumbnailCacheKey): Promise<Blob | null> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);

      return new Promise((resolve, reject) => {
        const request = store.get(this.buildKey(key));
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const result = request.result as CachedThumbnail | undefined;
          resolve(result?.blob ?? null);
        };
      });
    } catch (error) {
      console.warn("Thumbnail cache get failed:", error);
      return null;
    }
  }

  async set(key: ThumbnailCacheKey, blob: Blob): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);

      const entry: CachedThumbnail & { key: string } = {
        key: this.buildKey(key),
        sequenceName: key.sequenceName,
        bluePropType: key.bluePropType,
        redPropType: key.redPropType,
        lightMode: key.lightMode,
        blob,
        timestamp: Date.now(),
      };

      return new Promise((resolve, reject) => {
        const request = store.put(entry);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    } catch (error) {
      console.warn("Thumbnail cache set failed:", error);
    }
  }

  async has(key: ThumbnailCacheKey): Promise<boolean> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);

      return new Promise((resolve, reject) => {
        const request = store.count(IDBKeyRange.only(this.buildKey(key)));
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result > 0);
      });
    } catch (error) {
      console.warn("Thumbnail cache has failed:", error);
      return false;
    }
  }

  async clear(): Promise<void> {
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
      console.warn("Thumbnail cache clear failed:", error);
    }
  }

  async getStats(): Promise<{ count: number; sizeBytes: number }> {
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
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>)
            .result;
          if (cursor) {
            count++;
            const entry = cursor.value as CachedThumbnail;
            sizeBytes += entry.blob.size;
            cursor.continue();
          } else {
            resolve({ count, sizeBytes });
          }
        };
      });
    } catch (error) {
      console.warn("Thumbnail cache getStats failed:", error);
      return { count: 0, sizeBytes: 0 };
    }
  }

  async prune(maxSizeBytes: number): Promise<number> {
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
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>)
            .result;
          if (cursor) {
            const entry = cursor.value as CachedThumbnail & { key: string };
            entries.push({ key: entry.key, size: entry.blob.size });
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

      return deletedCount;
    } catch (error) {
      console.warn("Thumbnail cache prune failed:", error);
      return 0;
    }
  }
}

/**
 * Helper to check if user is in cat-dog mode
 */
export function isCatDogMode(
  bluePropType: PropType | undefined,
  redPropType: PropType | undefined,
  catDogModeEnabled: boolean | undefined
): boolean {
  if (!catDogModeEnabled) return false;
  if (!bluePropType || !redPropType) return false;
  return bluePropType !== redPropType;
}

/**
 * Get thumbnail path for user's prop configuration
 * Returns static path for single-prop, null for cat-dog (needs dynamic render)
 */
export function getThumbnailPathForPropConfig(
  sequenceName: string,
  bluePropType: PropType | undefined,
  redPropType: PropType | undefined,
  catDogModeEnabled: boolean | undefined,
  lightMode: boolean = false
): string | null {
  // Cat-dog mode requires dynamic rendering
  if (isCatDogMode(bluePropType, redPropType, catDogModeEnabled)) {
    return null;
  }

  // Single-prop mode: use pre-rendered static image
  const propType = bluePropType ?? redPropType ?? "staff";
  const modeSuffix = lightMode ? "_light" : "_dark";
  return `/gallery/${propType}/${sequenceName}${modeSuffix}.webp`;
}
