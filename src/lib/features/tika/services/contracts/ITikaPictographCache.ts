/**
 * Contract for TIKA Pictograph Cache
 *
 * Caches base64 pictograph images fetched from the API to avoid
 * redundant requests and reduce load on the MCP server.
 */

export interface TikaPictographCacheStats {
  memoryCount: number;
  persistedCount: number;
  sizeBytes: number;
}

export interface ITikaPictographCache {
  /**
   * Get a cached pictograph by key
   * @param key Format: `${letter}-${variation}-${optionsHash}`
   * @returns Base64 image string or null if not cached
   */
  get(key: string): Promise<string | null>;

  /**
   * Cache a pictograph
   * @param key Format: `${letter}-${variation}-${optionsHash}`
   * @param base64 The base64-encoded image
   */
  set(key: string, base64: string): Promise<void>;

  /**
   * Check if a pictograph is cached
   */
  has(key: string): Promise<boolean>;

  /**
   * Get multiple pictographs at once (for gallery display)
   */
  getMany(keys: string[]): Promise<Map<string, string>>;

  /**
   * Clear all cached pictographs
   */
  clear(): Promise<void>;

  /**
   * Get cache statistics
   */
  getStats(): Promise<TikaPictographCacheStats>;
}
