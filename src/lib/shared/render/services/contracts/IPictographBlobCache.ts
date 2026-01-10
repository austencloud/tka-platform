/**
 * IPictographBlobCache
 *
 * Layer 1 of the two-layer pictograph caching system.
 * Persists rasterized pictograph images (as Blobs) to IndexedDB.
 *
 * Why Blobs instead of SVG strings?
 * - SVG strings must be re-parsed and rasterized by the browser
 * - Blobs are already rasterized, so creating images is instant
 * - Benchmark showed L1 SVG cache had 0.1% speedup vs 91.9% for L2 memory cache
 *
 * Cache keys include size (unlike original SVG cache) since Blobs are size-specific.
 * Format: `${baseHash}:${size}`
 */

export interface PictographBlobCacheStats {
  /** Number of cached entries */
  count: number;
  /** Total size in bytes */
  sizeBytes: number;
}

export interface IPictographBlobCache {
  /**
   * Get a cached image blob by its key
   * @returns The Blob if cached, null otherwise
   */
  get(key: string): Promise<Blob | null>;

  /**
   * Store an image blob in the cache
   * @param key The cache key (includes size)
   * @param blob The image Blob to cache
   */
  set(key: string, blob: Blob): Promise<void>;

  /**
   * Check if a key exists in the cache
   */
  has(key: string): Promise<boolean>;

  /**
   * Clear all cached entries
   */
  clear(): Promise<void>;

  /**
   * Get cache statistics for monitoring
   */
  getStats(): Promise<PictographBlobCacheStats>;

  /**
   * Prune old entries to stay under a size limit
   * @param maxSizeBytes Maximum cache size in bytes
   * @returns Number of entries removed
   */
  prune(maxSizeBytes: number): Promise<number>;
}
