/**
 * JSON Cache Contract
 *
 * Interface for caching JSON data loaded from files.
 * Implementations can use browser fetch() or Node.js fs.
 */

export interface IJsonCache {
  /**
   * Get JSON data from cache or load it
   */
  get<T = unknown>(path: string): Promise<T>;

  /**
   * Check if we have cached data for this path
   */
  has(path: string): boolean;

  /**
   * Invalidate a specific cache entry
   */
  invalidate(path: string): void;

  /**
   * Clear all cached data
   */
  clear(): void;
}
