/**
 * IVideoCache
 *
 * Service for caching video blobs in IndexedDB for instant playback.
 * Used by video browsers, curators, and any component displaying videos.
 */
export interface IVideoCache {
  /**
   * Get a cached video URL (blob URL if cached, original URL if not)
   * Optionally triggers background caching if not yet cached
   */
  getVideoUrl(originalUrl: string, options?: GetVideoOptions): Promise<string>;

  /**
   * Check if a video is cached
   */
  isCached(url: string): Promise<boolean>;

  /**
   * Preload videos into cache (fire and forget)
   */
  preload(urls: string[]): void;

  /**
   * Get cache statistics
   */
  getStats(): Promise<CacheStats>;

  /**
   * Clear old cache entries to free space
   */
  cleanup(maxAgeDays?: number): Promise<number>;

  /**
   * Clear entire cache
   */
  clearAll(): Promise<void>;
}

export interface GetVideoOptions {
  /** If true, cache in background if not already cached */
  cacheIfMissing?: boolean;
  /** Priority for caching (higher = sooner) */
  priority?: number;
}

export interface CacheStats {
  /** Number of cached videos */
  count: number;
  /** Total size in bytes */
  totalSize: number;
  /** Oldest entry date */
  oldestEntry: Date | null;
}

export interface CachedVideo {
  url: string;
  blob: Blob;
  size: number;
  cachedAt: Date;
  lastAccessed: Date;
}
