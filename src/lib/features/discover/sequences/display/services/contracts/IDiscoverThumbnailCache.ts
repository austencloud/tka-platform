/**
 * Thumbnail Cache for Cat-Dog Mode
 *
 * Caches rendered thumbnails for mixed-prop configurations (cat-dog mode)
 * where pre-rendered static images aren't available.
 */

import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

export interface CachedThumbnail {
  sequenceName: string;
  bluePropType: PropType;
  redPropType: PropType;
  lightMode: boolean;
  blob: Blob;
  timestamp: number;
}

export interface ThumbnailCacheKey {
  sequenceName: string;
  bluePropType: PropType;
  redPropType: PropType;
  lightMode: boolean;
}

export interface IDiscoverThumbnailCache {
  /**
   * Get cached thumbnail for a specific prop configuration
   */
  get(key: ThumbnailCacheKey): Promise<Blob | null>;

  /**
   * Store thumbnail in cache
   */
  set(key: ThumbnailCacheKey, blob: Blob): Promise<void>;

  /**
   * Check if thumbnail exists in cache
   */
  has(key: ThumbnailCacheKey): Promise<boolean>;

  /**
   * Clear all cached thumbnails
   */
  clear(): Promise<void>;

  /**
   * Get cache statistics
   */
  getStats(): Promise<{ count: number; sizeBytes: number }>;

  /**
   * Prune old entries if cache exceeds size limit
   */
  prune(maxSizeBytes: number): Promise<number>;
}
