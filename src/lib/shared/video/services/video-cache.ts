/**
 * VideoCache
 *
 * IndexedDB-based video caching for instant playback.
 * Stores video blobs locally to eliminate buffering on repeat views.
 *
 * Features:
 * - Persistent cache survives page reloads
 * - Background preloading with priority queue
 * - LRU-style cleanup based on last access time
 * - Memory-efficient blob URL management
 */
import type {
  GetVideoOptions,
  CacheStats,
  CachedVideo,
} from "./types";

const DB_NAME = "tka-video-cache";
const DB_VERSION = 1;
const STORE_NAME = "videos";
const MAX_CACHE_SIZE_MB = 500; // 500MB max cache
const DEFAULT_MAX_AGE_DAYS = 30;

export class VideoCache {
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;
  private blobUrls = new Map<string, string>(); // original URL -> blob URL
  private preloadQueue: Array<{ url: string; priority: number }> = [];
  private isPreloading = false;
  private activeDownloads = new Set<string>();

  /**
   * Initialize/get the IndexedDB database
   */
  private async getDb(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error("[VideoCache] Failed to open IndexedDB:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create videos store with indexes
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "url" });
          store.createIndex("cachedAt", "cachedAt", { unique: false });
          store.createIndex("lastAccessed", "lastAccessed", { unique: false });
          store.createIndex("size", "size", { unique: false });
        }
      };
    });

    return this.dbPromise;
  }

  /**
   * Get a cached video URL, returning blob URL if cached
   */
  async getVideoUrl(
    originalUrl: string,
    options: GetVideoOptions = {}
  ): Promise<string> {
    const { cacheIfMissing = true, priority = 0 } = options;

    // Check in-memory blob URL first
    if (this.blobUrls.has(originalUrl)) {
      // Update last accessed time in background
      this.updateLastAccessed(originalUrl);
      return this.blobUrls.get(originalUrl)!;
    }

    // Check IndexedDB
    try {
      const cached = await this.getCachedVideo(originalUrl);
      if (cached) {
        // Create blob URL and store in memory
        const blobUrl = URL.createObjectURL(cached.blob);
        this.blobUrls.set(originalUrl, blobUrl);
        this.updateLastAccessed(originalUrl);
        return blobUrl;
      }
    } catch (e) {
      console.warn("[VideoCache] Error reading from cache:", e);
    }

    // Not cached - optionally trigger background caching
    if (cacheIfMissing && !this.activeDownloads.has(originalUrl)) {
      this.addToPreloadQueue(originalUrl, priority + 10); // Higher priority for user-requested
    }

    // Return original URL while caching happens in background
    return originalUrl;
  }

  /**
   * Check if a video is cached
   */
  async isCached(url: string): Promise<boolean> {
    if (this.blobUrls.has(url)) return true;

    try {
      const cached = await this.getCachedVideo(url);
      return cached !== null;
    } catch {
      return false;
    }
  }

  /**
   * Preload videos into cache
   */
  preload(urls: string[]): void {
    for (const url of urls) {
      this.addToPreloadQueue(url, 0);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    try {
      const db = await this.getDb();
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);

      return new Promise((resolve, reject) => {
        const countRequest = store.count();
        let count = 0;
        let totalSize = 0;
        let oldestEntry: Date | null = null;

        countRequest.onsuccess = () => {
          count = countRequest.result;
        };

        const cursorRequest = store.openCursor();
        cursorRequest.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>)
            .result;
          if (cursor) {
            const video = cursor.value as CachedVideo;
            totalSize += video.size;
            if (!oldestEntry || video.cachedAt < oldestEntry) {
              oldestEntry = video.cachedAt;
            }
            cursor.continue();
          } else {
            resolve({ count, totalSize, oldestEntry });
          }
        };

        cursorRequest.onerror = () => reject(cursorRequest.error);
      });
    } catch {
      return { count: 0, totalSize: 0, oldestEntry: null };
    }
  }

  /**
   * Cleanup old cache entries
   */
  async cleanup(maxAgeDays: number = DEFAULT_MAX_AGE_DAYS): Promise<number> {
    try {
      const db = await this.getDb();
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const index = store.index("lastAccessed");

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

      let deletedCount = 0;

      return new Promise((resolve, reject) => {
        const range = IDBKeyRange.upperBound(cutoffDate);
        const cursorRequest = index.openCursor(range);

        cursorRequest.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>)
            .result;
          if (cursor) {
            const video = cursor.value as CachedVideo;
            // Revoke blob URL if we have one
            const blobUrl = this.blobUrls.get(video.url);
            if (blobUrl) {
              URL.revokeObjectURL(blobUrl);
              this.blobUrls.delete(video.url);
            }
            cursor.delete();
            deletedCount++;
            cursor.continue();
          } else {
            resolve(deletedCount);
          }
        };

        cursorRequest.onerror = () => reject(cursorRequest.error);
      });
    } catch {
      return 0;
    }
  }

  /**
   * Clear entire cache
   */
  async clearAll(): Promise<void> {
    // Revoke all blob URLs
    for (const blobUrl of this.blobUrls.values()) {
      URL.revokeObjectURL(blobUrl);
    }
    this.blobUrls.clear();

    try {
      const db = await this.getDb();
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.clear();
    } catch (e) {
      console.error("[VideoCache] Failed to clear cache:", e);
    }
  }

  /**
   * Release a video's blob URL from memory.
   * The video stays cached in IndexedDB - only the in-memory blob URL is revoked.
   * Call this when a video is no longer being displayed to prevent memory leaks.
   */
  releaseVideo(originalUrl: string): void {
    const blobUrl = this.blobUrls.get(originalUrl);
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      this.blobUrls.delete(originalUrl);
    }
  }

  /**
   * Release all currently held blob URLs.
   * Useful for cleanup when a video player component unmounts.
   */
  releaseAllBlobUrls(): void {
    for (const blobUrl of this.blobUrls.values()) {
      URL.revokeObjectURL(blobUrl);
    }
    this.blobUrls.clear();
  }


  private async getCachedVideo(url: string): Promise<CachedVideo | null> {
    const db = await this.getDb();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.get(url);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  private async saveVideo(url: string, blob: Blob): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    const video: CachedVideo = {
      url,
      blob,
      size: blob.size,
      cachedAt: new Date(),
      lastAccessed: new Date(),
    };

    return new Promise((resolve, reject) => {
      const request = store.put(video);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async updateLastAccessed(url: string): Promise<void> {
    try {
      const db = await this.getDb();
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);

      const getRequest = store.get(url);
      getRequest.onsuccess = () => {
        const video = getRequest.result as CachedVideo | undefined;
        if (video) {
          video.lastAccessed = new Date();
          store.put(video);
        }
      };
    } catch {
      // Ignore errors for background update
    }
  }

  private addToPreloadQueue(url: string, priority: number): void {
    // Don't add duplicates or already-downloading
    if (
      this.activeDownloads.has(url) ||
      this.preloadQueue.some((item) => item.url === url)
    ) {
      return;
    }

    this.preloadQueue.push({ url, priority });
    this.preloadQueue.sort((a, b) => b.priority - a.priority);

    this.processPreloadQueue();
  }

  private async processPreloadQueue(): Promise<void> {
    if (this.isPreloading) return;
    if (this.preloadQueue.length === 0) return;

    // Check cache size before downloading more
    const stats = await this.getStats();
    if (stats.totalSize > MAX_CACHE_SIZE_MB * 1024 * 1024) {
      await this.cleanup(7); // Cleanup items older than 7 days if over limit
    }

    this.isPreloading = true;

    while (this.preloadQueue.length > 0) {
      const item = this.preloadQueue.shift()!;

      // Skip if already cached or downloading
      if (this.blobUrls.has(item.url) || this.activeDownloads.has(item.url)) {
        continue;
      }

      // Check IndexedDB
      const isCached = await this.isCached(item.url);
      if (isCached) continue;

      // Download and cache
      await this.downloadAndCache(item.url);
    }

    this.isPreloading = false;
  }

  private async downloadAndCache(url: string): Promise<void> {
    this.activeDownloads.add(url);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();

      // Save to IndexedDB
      await this.saveVideo(url, blob);

      const prev = this.blobUrls.get(url);
      if (prev) URL.revokeObjectURL(prev);
      const blobUrl = URL.createObjectURL(blob);
      this.blobUrls.set(url, blobUrl);

      console.debug(`[VideoCache] Cached: ${url.split("/").pop()}`);
    } catch (e) {
      console.warn(`[VideoCache] Failed to cache ${url}:`, e);
    } finally {
      this.activeDownloads.delete(url);
    }
  }
}
