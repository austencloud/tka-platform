/**
 * ThumbnailRenderOrchestrator
 *
 * Coordinates the 4-tier thumbnail loading pipeline:
 * 1. Static bundled (instant) - pre-rendered thumbnails in /static/thumbnails/
 * 2. Local IndexedDB (instant) - personalized cache of viewed thumbnails
 * 3. Cloud cache (fast) - Firebase Storage with manifest
 * 4. Local render (slow) - Canvas2D rendering as final fallback
 *
 * Static thumbnails are synced from cloud during releases for instant loading.
 * Local cache provides instant loading for frequently-viewed sequences.
 * This is the main entry point for components.
 */

import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type {
  IThumbnailRenderOrchestrator,
  ThumbnailRequest,
  ThumbnailResult,
} from "../contracts/IThumbnailRenderOrchestrator";
import type {
  IThumbnailKeyDeriver,
  ThumbnailCacheKey,
} from "../contracts/IThumbnailKeyDeriver";
import type { IThumbnailRenderQueue } from "../contracts/IThumbnailRenderQueue";
import type { IThumbnailRenderer } from "../contracts/IThumbnailRenderer";
import type { ICloudThumbnailCache } from "../contracts/ICloudThumbnailCache";
import type { IThumbnailLocalCache } from "../contracts/IThumbnailLocalCache";
import type { IThumbnailMetricsCollector } from "../contracts/IThumbnailMetricsCollector";

// Static thumbnail manifest - loaded once, lists all bundled thumbnails
let staticManifest: Set<string> | null = null;
let staticManifestLoading: Promise<Set<string>> | null = null;

async function getStaticManifest(): Promise<Set<string>> {
  if (staticManifest) return staticManifest;
  if (staticManifestLoading) return staticManifestLoading;

  staticManifestLoading = (async () => {
    try {
      const response = await fetch("/thumbnails/manifest.json");
      if (!response.ok) {
        staticManifest = new Set();
        return staticManifest;
      }
      const data = await response.json() as { keys: string[] };
      staticManifest = new Set(data.keys);
      console.log(`[Static] Loaded manifest: ${staticManifest.size} thumbnails`);
      return staticManifest;
    } catch {
      staticManifest = new Set();
      return staticManifest;
    } finally {
      staticManifestLoading = null;
    }
  })();

  return staticManifestLoading;
}

export class ThumbnailRenderOrchestrator implements IThumbnailRenderOrchestrator {
  private completedCount = 0;

  constructor(
    private keyDeriver: IThumbnailKeyDeriver,
    private queue: IThumbnailRenderQueue,
    private renderer: IThumbnailRenderer,
    private cloudCache: ICloudThumbnailCache,
    private localCache: IThumbnailLocalCache,
    private metrics?: IThumbnailMetricsCollector
  ) {}

  async getThumbnail(request: ThumbnailRequest): Promise<ThumbnailResult> {
    const key = this.keyDeriver.deriveKey(request.input);
    const cloudKey = this.buildCloudKey(key);

    // Start metrics tracking
    const requestId = this.metrics?.startRequest(true) ?? "";

    // Step 1: Check STATIC bundled thumbnails (instant, no network latency)
    // These are synced from cloud during releases for instant loading
    // Only for default settings (static thumbnails use standard rendering)
    if (key.usesDefaults && !request.skipCache) {
      const staticKey = this.buildStaticKey(key);
      const manifest = await getStaticManifest();

      if (manifest.has(staticKey)) {
        const staticUrl = `/thumbnails/${staticKey}.webp`;
        this.completedCount++;
        this.metrics?.endRequest(requestId, "static");
        request.onStatusChange?.({ state: "complete", url: staticUrl });
        return { url: staticUrl, fromCache: true, key };
      } else if (manifest.size > 0) {
        // Log sequences not found in static manifest (for debugging cache coverage)
        console.debug(`[Static] Not in manifest: "${staticKey}" (sequence: ${key.inputs.sequenceName})`);
      }
    }

    // Step 2: Check LOCAL IndexedDB cache (instant, personalized)
    // Works for ALL thumbnails - cat-dog, custom settings, everything
    if (!request.skipCache) {
      const localBlob = await this.localCache.get(key.hash);
      if (localBlob) {
        const url = URL.createObjectURL(localBlob);
        this.completedCount++;
        this.metrics?.endRequest(requestId, "local");
        request.onStatusChange?.({ state: "complete", url });
        return { url, fromCache: true, key };
      }
    }

    // Step 3: Check in-memory URL cache (instant, session-only)
    if (key.usesDefaults && !request.skipCache) {
      const memoryCached = this.cloudCache.getCachedUrl(cloudKey);
      if (memoryCached) {
        this.completedCount++;
        this.metrics?.endRequest(requestId, "cloud");
        request.onStatusChange?.({ state: "complete", url: memoryCached });
        return { url: memoryCached, fromCache: true, key };
      }

      // Step 4: Check cloud cache (network request)
      // This runs BEFORE queueing so cached items don't wait in line
      if (memoryCached === undefined) {
        request.onStatusChange?.({ state: "checking-cache" });
        const cloudUrl = await this.cloudCache.getUrl(cloudKey, request.priority);
        if (cloudUrl) {
          // Found in cloud - fetch blob and save to local cache
          this.saveCloudBlobToLocal(cloudUrl, key.hash);
          this.completedCount++;
          this.metrics?.endRequest(requestId, "cloud");
          request.onStatusChange?.({ state: "complete", url: cloudUrl });
          return { url: cloudUrl, fromCache: true, key };
        }
      }
    }

    // Step 5: Need to render - queue to throttle concurrent renders
    request.onStatusChange?.({ state: "queued", position: 0 });
    const queueStartTime = performance.now();

    // Track queue depth
    const queueStats = this.queue.getStats();
    this.metrics?.recordQueueDepth(queueStats.queued + queueStats.active);

    try {
      return await this.queue.enqueue(key.hash, async () => {
        const queueWaitTime = performance.now() - queueStartTime;
        const renderStartTime = performance.now();

        // Render locally with progress tracking
        request.onStatusChange?.({ state: "rendering" });
        const blob = await this.renderer.render(
          request.sequence,
          key.inputs,
          undefined, // use default render options
          (progress) => {
            // Forward progress updates to status callback
            request.onStatusChange?.({
              state: "rendering",
              progress: {
                current: progress.current,
                total: progress.total,
                stage: progress.stage,
              },
            });
          }
        );

        const renderTime = performance.now() - renderStartTime;

        // Create blob URL for display
        const url = URL.createObjectURL(blob);

        // Save to local cache (for ALL thumbnails - instant next time)
        this.localCache.set(key.hash, blob).catch(() => {});

        // Upload to cloud (for default settings only - shared cache)
        if (key.usesDefaults) {
          this.uploadToCloud(key, blob);
        }

        this.completedCount++;
        this.metrics?.endRequest(requestId, "render", { queueWaitTime, renderTime });
        request.onStatusChange?.({ state: "complete", url });

        return { url, fromCache: false, key };
      }, request.priority);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      // Let cancellations propagate
      if (err.message === "Cancelled") {
        this.metrics?.cancelRequest(requestId);
        throw err;
      }

      // Log the error but don't throw - return a failed result gracefully
      // This prevents unhandled promise rejections for corrupt/orphaned sequences
      console.warn(
        `[ThumbnailRenderOrchestrator] Failed to render "${key.inputs.sequenceName}":`,
        err.message
      );
      this.metrics?.endRequest(requestId, "failed");
      request.onStatusChange?.({ state: "error", error: err });

      // Return a failed result instead of throwing
      return { url: null, fromCache: false, key, error: err };
    }
  }

  cancel(key: Pick<ThumbnailCacheKey, "hash">): void {
    this.queue.cancel(key.hash);
  }

  cancelAll(): void {
    this.queue.cancelAll();
  }

  getQueueStats(): { queued: number; active: number; completed: number } {
    const queueStats = this.queue.getStats();
    return {
      queued: queueStats.queued,
      active: queueStats.active,
      completed: this.completedCount,
    };
  }

  private buildCloudKey(key: ThumbnailCacheKey) {
    return {
      sequenceName: key.inputs.sequenceName,
      propType: key.propKey as PropType,
      lightMode: key.inputs.lightMode,
      variant: key.inputs.variant,
    };
  }

  /**
   * Build key for static manifest lookup
   * Format: {propType}/{sequenceName}_{mode}
   * Static thumbnails use legacy format (no variant level) for backwards compatibility
   * Must match the keys in /static/thumbnails/manifest.json
   */
  private buildStaticKey(key: ThumbnailCacheKey): string {
    const modeSuffix = key.inputs.lightMode ? "_light" : "_dark";
    // Sanitize sequence name for Windows compatibility (colons from timestamps, etc.)
    const sanitizedName = key.inputs.sequenceName
      .replace(/:/g, "-")
      .replace(/[?<>"|*]/g, "_");
    return `${key.propKey}/${sanitizedName}${modeSuffix}`;
  }

  private uploadToCloud(key: ThumbnailCacheKey, blob: Blob): void {
    this.cloudCache
      .upload(this.buildCloudKey(key), blob)
      .then(() => {
        this.metrics?.recordUpload(true);
      })
      .catch(() => {
        // Non-fatal - image is displayed, just couldn't upload for others
        this.metrics?.recordUpload(false);
      });
  }

  /**
   * Fetch blob from cloud URL and save to local cache (async, non-blocking)
   * This ensures cloud-cached images are also saved locally for offline/instant access
   */
  private saveCloudBlobToLocal(url: string, hash: string): void {
    fetch(url)
      .then((response) => response.blob())
      .then((blob) => this.localCache.set(hash, blob))
      .catch(() => {
        // Non-fatal - cloud URL still works, just won't be cached locally
      });
  }
}
