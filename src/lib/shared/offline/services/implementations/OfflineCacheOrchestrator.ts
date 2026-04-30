/**
 * OfflineCacheOrchestrator
 *
 * Coordinates proactive background caching so the app works offline.
 *
 * Two tasks run in sequence after the gallery first loads:
 *  1. Gallery metadata - persisted automatically by GalleryOfflineCache whenever
 *     PublicSequencesLoader fetches from Firestore. Nothing to do here.
 *  2. Thumbnail prefetch - download each sequence's first thumbnail into
 *     ThumbnailLocalCache so the gallery renders without network.
 *
 * Background mode throttles concurrency to connection quality so the prefetch
 * is invisible to the user. Full-speed mode (user-triggered "Download for
 * offline") uses maximum concurrency.
 */

import type { IOfflineCacheOrchestrator } from "../contracts/IOfflineCacheOrchestrator";
import type { INetworkStatusMonitor } from "$lib/shared/sync/services/contracts/INetworkStatusMonitor";
import type { IGalleryOfflineCache } from "../contracts/IGalleryOfflineCache";
import type { IThumbnailLocalCache } from "$lib/features/browse/sequences/display/services/contracts/IThumbnailLocalCache";
import type { OfflineCacheStats } from "../../domain/offline-cache-types";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export class OfflineCacheOrchestrator implements IOfflineCacheOrchestrator {
  private cancelled = false;
  private prefetching = false;

  constructor(
    private networkMonitor: INetworkStatusMonitor,
    private galleryCache: IGalleryOfflineCache,
    private thumbnailCache: IThumbnailLocalCache
  ) {}

  /**
   * Start background prefetch after the gallery loads.
   * Only proceeds if we actually have cached gallery data to pull URLs from.
   * Runs at adaptive concurrency so it doesn't compete with foreground traffic.
   */
  async startBackgroundCache(): Promise<void> {
    this.cancelled = false;

    const stats = await this.galleryCache.getStats();
    if (stats.count === 0) {
      // Gallery hasn't loaded yet - nothing to prefetch.
      return;
    }

    await this.prefetchThumbnails(false);
  }

  /**
   * User-triggered "Download for offline". Runs at full speed (10 concurrent).
   */
  async downloadForOffline(): Promise<void> {
    this.cancelled = false;
    await this.prefetchThumbnails(true);
  }

  /** Cancel any in-progress prefetch. */
  cancel(): void {
    this.cancelled = true;
  }

  /** Combined stats for the settings panel. */
  async getCacheStats(): Promise<OfflineCacheStats> {
    const [galleryStats, thumbnailStats] = await Promise.all([
      this.galleryCache.getStats(),
      this.thumbnailCache.getStats(),
    ]);
    return {
      gallerySequenceCount: galleryStats.count,
      galleryLastSyncedAt: galleryStats.lastSyncedAt,
      thumbnailsCached: thumbnailStats.count,
      thumbnailsSizeBytes: thumbnailStats.sizeBytes,
      propSvgsCached: true, // Always true - prop SVGs are in Workbox precache
      isOfflineReady: galleryStats.count > 0,
    };
  }

  /** Wipe everything. Cancels in-progress work first. */
  async clearOfflineCache(): Promise<void> {
    this.cancel();
    await Promise.all([
      this.galleryCache.clear(),
      this.thumbnailCache.clear(),
    ]);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Download thumbnails for all cached gallery sequences that don't already
   * have a local copy.
   *
   * @param fullSpeed - true = max concurrency (10); false = adaptive to network
   */
  private async prefetchThumbnails(fullSpeed: boolean): Promise<void> {
    if (this.prefetching) return;
    this.prefetching = true;

    try {
      const { sequences } = await this.galleryCache.loadCached();

      // Only process sequences that have at least one thumbnail URL.
      const withThumbnails = sequences.filter(
        (s): s is SequenceData & { thumbnails: readonly [string, ...string[]] } =>
          s.thumbnails.length > 0
      );

      if (withThumbnails.length === 0) return;

      const concurrency = fullSpeed ? 10 : this.getConcurrency();

      // Process in batches of `concurrency`.
      for (let i = 0; i < withThumbnails.length; i += concurrency) {
        if (this.cancelled) break;

        // Pause while the tab is hidden - save battery on mobile.
        if (typeof document !== "undefined" && document.hidden) {
          await this.waitForVisible();
        }

        if (this.cancelled) break;

        // Pause if the device goes offline mid-batch.
        if (!this.networkMonitor.isOnline) {
          await this.waitForOnline();
        }

        if (this.cancelled) break;

        const batch = withThumbnails.slice(i, i + concurrency);

        await Promise.allSettled(
          batch.map(async (sequence) => {
            const url = sequence.thumbnails[0];

            // Skip already-cached entries - avoids redundant fetches.
            if (await this.thumbnailCache.has(url)) return;

            try {
              const response = await fetch(url);
              if (!response.ok) return;

              const blob = await response.blob();
              await this.thumbnailCache.set(url, blob);
            } catch {
              // Network failure for one thumbnail shouldn't abort the batch.
            }
          })
        );
      }
    } finally {
      this.prefetching = false;
    }
  }

  /**
   * Choose batch concurrency based on the current connection quality.
   * Falls back to a conservative value when the Network Information API is
   * unavailable or the type is unknown.
   */
  private getConcurrency(): number {
    const status = this.networkMonitor.status;

    if (status.saveData) return 1;
    if (status.isMetered) return 1;

    switch (status.effectiveType) {
      case "4g":
        return 10;
      case "3g":
        return 3;
      case "2g":
      case "slow-2g":
        return 1;
      default:
        return 5;
    }
  }

  /**
   * Resolve when the document becomes visible again.
   * Used to pause background work while the tab is hidden.
   */
  private waitForVisible(): Promise<void> {
    return new Promise((resolve) => {
      // Poll cancelled flag so cancel() breaks out of the wait
      const interval = setInterval(() => {
        if (this.cancelled) {
          clearInterval(interval);
          document.removeEventListener("visibilitychange", handler);
          resolve();
        }
      }, 1000);

      const handler = () => {
        if (!document.hidden) {
          clearInterval(interval);
          document.removeEventListener("visibilitychange", handler);
          resolve();
        }
      };
      document.addEventListener("visibilitychange", handler);
    });
  }

  /**
   * Resolve when the network comes back online.
   * Used to pause background work when the device loses connectivity.
   */
  private waitForOnline(): Promise<void> {
    return new Promise((resolve) => {
      // Poll cancelled flag so cancel() breaks out of the wait
      const interval = setInterval(() => {
        if (this.cancelled) {
          clearInterval(interval);
          unsub();
          resolve();
        }
      }, 1000);

      const unsub = this.networkMonitor.onOnlineChange((isOnline) => {
        if (isOnline) {
          clearInterval(interval);
          unsub();
          resolve();
        }
      });
    });
  }
}
