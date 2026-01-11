/**
 * IThumbnailLocalCache
 *
 * IndexedDB-based local cache for thumbnails.
 * Provides instant personalized caching - sequences you view most load instantly.
 * Sits between static bundled and cloud cache in the 4-tier hierarchy.
 */

export interface ThumbnailLocalCacheStats {
  count: number;
  sizeBytes: number;
}

export interface IThumbnailLocalCache {
  /**
   * Get cached thumbnail blob by hash key
   */
  get(key: string): Promise<Blob | null>;

  /**
   * Store thumbnail blob in local cache
   */
  set(key: string, blob: Blob): Promise<void>;

  /**
   * Check if thumbnail exists in cache (faster than get for existence checks)
   */
  has(key: string): Promise<boolean>;

  /**
   * Clear all cached thumbnails
   */
  clear(): Promise<void>;

  /**
   * Get cache statistics
   */
  getStats(): Promise<ThumbnailLocalCacheStats>;

  /**
   * Prune oldest entries if cache exceeds size limit (LRU eviction)
   * Returns number of entries deleted
   */
  prune(maxSizeBytes: number): Promise<number>;
}
