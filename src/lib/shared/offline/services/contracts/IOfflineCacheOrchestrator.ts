/**
 * IOfflineCacheOrchestrator
 *
 * Coordinates proactive caching for offline use.
 * Manages gallery metadata persistence (via GalleryOfflineCache)
 * and thumbnail prefetching (via ThumbnailLocalCache).
 */

import type { OfflineCacheStats } from "../../domain/offline-cache-types";

export interface IOfflineCacheOrchestrator {
  /** Start background caching (gallery + thumbnails). Call after gallery loads. */
  startBackgroundCache(): Promise<void>;

  /** User-triggered full download. Caches everything at full speed. */
  downloadForOffline(): Promise<void>;

  /** Cancel in-progress caching. */
  cancel(): void;

  /** Get cache stats for settings panel. */
  getCacheStats(): Promise<OfflineCacheStats>;

  /** Clear all offline caches (gallery + prefetched thumbnails). */
  clearOfflineCache(): Promise<void>;
}
