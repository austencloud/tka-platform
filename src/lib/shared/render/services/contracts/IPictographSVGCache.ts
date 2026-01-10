/**
 * IPictographSVGCache
 *
 * Layer 1 of the two-layer pictograph caching system.
 * Persists base pictograph SVGs (without beat numbers) to IndexedDB.
 *
 * Cache keys are derived from pictograph properties (letter, motions, visibility)
 * but explicitly EXCLUDE beat number and size, allowing identical pictographs
 * across different sequences to share cached SVGs.
 */

export interface PictographCacheStats {
  /** Number of cached entries */
  count: number;
  /** Total size in bytes (approximate, based on SVG string length) */
  sizeBytes: number;
}

export interface IPictographSVGCache {
  /**
   * Get a cached SVG by its key hash
   * @returns The SVG string if cached, null otherwise
   */
  get(key: string): Promise<string | null>;

  /**
   * Store an SVG in the cache
   * @param key The hash key for this pictograph configuration
   * @param svg The SVG string to cache
   */
  set(key: string, svg: string): Promise<void>;

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
  getStats(): Promise<PictographCacheStats>;

  /**
   * Prune old entries to stay under a size limit
   * @param maxSizeBytes Maximum cache size in bytes
   * @returns Number of entries removed
   */
  prune(maxSizeBytes: number): Promise<number>;
}
