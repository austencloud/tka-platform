/**
 * PictographMemoryCache
 *
 * Layer 2 of the two-layer pictograph caching system.
 * In-memory LRU cache of sized HTMLImageElements ready for canvas drawing.
 *
 * HMR-aware: Persists cache across hot module reloads during development.
 * Key format: `${baseHash}:${size}` to cache different sizes of the same pictograph.
 */

// HMR-aware module-level storage (like GlyphCache pattern)
// This survives hot module reloads during development
const hmrImageCache: Map<string, HTMLImageElement> =
  (import.meta.hot?.data?.pictographImageCache as Map<string, HTMLImageElement>) ??
  new Map();

const hmrAccessOrder: string[] =
  (import.meta.hot?.data?.pictographAccessOrder as string[]) ?? [];

// Preserve cache across HMR
if (import.meta.hot) {
  import.meta.hot.dispose((data) => {
    data.pictographImageCache = hmrImageCache;
    data.pictographAccessOrder = hmrAccessOrder;
  });

  // Clear cache when module itself changes (not dependencies)
  import.meta.hot.accept(() => {
    // Don't clear on accept - we want to preserve cache across HMR
  });
}

// Increased from 200 to 2000 to reduce L2 misses
// Each HTMLImageElement is ~50-100KB, so 2000 entries ≈ 100-200MB max
const DEFAULT_MAX_ENTRIES = 2000;

export class PictographMemoryCache {
  private cache = hmrImageCache;
  private accessOrder = hmrAccessOrder;
  private maxEntries: number;

  constructor(maxEntries: number = DEFAULT_MAX_ENTRIES) {
    this.maxEntries = maxEntries;
  }

  /**
   * Generate a cache key from base hash and size
   */
  getKey(baseHash: string, size: number): string {
    return `${baseHash}:${size}`;
  }

  /**
   * Get an image from the cache, updating LRU order
   */
  get(key: string): HTMLImageElement | undefined {
    const img = this.cache.get(key);
    if (img) {
      // Move to end of access order (most recently used)
      const index = this.accessOrder.indexOf(key);
      if (index !== -1) {
        this.accessOrder.splice(index, 1);
      }
      this.accessOrder.push(key);
    }
    return img;
  }

  /**
   * Store an image in the cache, evicting oldest if at capacity
   */
  set(key: string, img: HTMLImageElement): void {
    // If key already exists, just update it
    if (this.cache.has(key)) {
      this.cache.set(key, img);
      // Update LRU order
      const index = this.accessOrder.indexOf(key);
      if (index !== -1) {
        this.accessOrder.splice(index, 1);
      }
      this.accessOrder.push(key);
      return;
    }

    // Evict oldest entries if at capacity
    while (this.cache.size >= this.maxEntries && this.accessOrder.length > 0) {
      const oldest = this.accessOrder.shift();
      if (oldest) {
        this.cache.delete(oldest);
      }
    }

    // Add new entry
    this.cache.set(key, img);
    this.accessOrder.push(key);
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder.length = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxEntries: number } {
    return {
      size: this.cache.size,
      maxEntries: this.maxEntries,
    };
  }

  /**
   * Update the maximum number of entries
   */
  setMaxEntries(max: number): void {
    this.maxEntries = Math.max(1, max);

    // Evict if over new limit
    while (this.cache.size > this.maxEntries && this.accessOrder.length > 0) {
      const oldest = this.accessOrder.shift();
      if (oldest) {
        this.cache.delete(oldest);
      }
    }
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
// Use this instead of getPictographMemoryCache() to avoid DI container rebuilds.
// The cache data itself is already HMR-aware via hmrImageCache and hmrAccessOrder.
// ============================================================================

// HMR-aware singleton instance
let hmrPictographMemoryCacheInstance: PictographMemoryCache | null =
  import.meta.hot?.data?.pictographMemoryCacheInstance ?? null;

if (import.meta.hot) {
  import.meta.hot.dispose((data) => {
    data.pictographMemoryCacheInstance = hmrPictographMemoryCacheInstance;
  });
}

function getPictographMemoryCache(): PictographMemoryCache {
  if (!hmrPictographMemoryCacheInstance) {
    hmrPictographMemoryCacheInstance = new PictographMemoryCache();
  }
  return hmrPictographMemoryCacheInstance;
}

export const pictographMemoryCache = getPictographMemoryCache();
