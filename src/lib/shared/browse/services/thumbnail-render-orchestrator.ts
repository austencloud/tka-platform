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

import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { ThumbnailRenderInput, ThumbnailCacheKey } from "./thumbnail-key-deriver";
import * as keyDeriverModule from "./thumbnail-key-deriver";
import type { ThumbnailRenderQueue } from "./thumbnail-render-queue";
import type { ThumbnailRenderer } from "$lib/shared/browse/services/thumbnail-renderer";
import * as cloudCacheModule from "$lib/shared/browse/services/cloud-thumbnail-cache";
import type { ThumbnailLocalCache } from "./thumbnail-local-cache";
import type { ThumbnailMetricsCollector } from "./thumbnail-metrics-collector";

export interface RenderProgress {
  current: number;
  total: number;
  stage: "preparing" | "rendering" | "finalizing";
}
export type ThumbnailLoadStatus =
  | { state: "idle" }
  | { state: "checking-cache" }
  | { state: "queued"; position: number }
  | { state: "rendering"; progress?: RenderProgress }
  | { state: "uploading" }
  | { state: "complete"; url: string }
  | { state: "error"; error: Error };
export interface ThumbnailRequest {
  /** The sequence to render */
  sequence: SequenceData;

  /** Render configuration */
  input: ThumbnailRenderInput;

  /** Optional callback for status updates */
  onStatusChange?: (status: ThumbnailLoadStatus) => void;

  /** Skip cloud cache check and render directly (use after 404 errors) */
  skipCache?: boolean;

  /** Priority for queue ordering (lower = higher priority). Use element's Y position. */
  priority?: number;
}
export interface ThumbnailResult {
  /** URL to display (either cloud URL or blob URL), null if render failed */
  url: string | null;

  /** Whether this came from cache (true) or was freshly rendered (false) */
  fromCache: boolean;

  /** The cache key used (for cancellation) */
  key: ThumbnailCacheKey;

  /** Error if rendering failed (only present when url is null) */
  error?: Error;
}

// In-memory LRU cache of hash → blobUrl for instant revisits.
// Survives component remounts within the same page session.
const MAX_MEMORY_ENTRIES = 500;

class MemoryUrlCache {
  private map = new Map<string, string>();

  get(hash: string): string | null {
    const url = this.map.get(hash);
    if (!url) return null;
    // Move to end (most recently used)
    this.map.delete(hash);
    this.map.set(hash, url);
    return url;
  }

  set(hash: string, url: string): void {
    if (this.map.has(hash)) {
      this.map.delete(hash);
    } else if (this.map.size >= MAX_MEMORY_ENTRIES) {
      // Evict oldest entry
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) {
        const oldUrl = this.map.get(oldest);
        this.map.delete(oldest);
        if (oldUrl?.startsWith("blob:")) {
          URL.revokeObjectURL(oldUrl);
        }
      }
    }
    this.map.set(hash, url);
  }

  clear(): void {
    for (const url of this.map.values()) {
      if (url.startsWith("blob:")) {
        URL.revokeObjectURL(url);
      }
    }
    this.map.clear();
  }
}

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

function uploadToCloud(orchestrator: ThumbnailRenderOrchestrator, key: ThumbnailCacheKey, blob: Blob): void {
  cloudCacheModule.upload(orchestrator.buildCloudKey(key), blob)
    .then(() => {
      orchestrator['metrics']?.recordUpload(true);
    })
    .catch(() => {
      // Non-fatal - image is displayed, just couldn't upload for others
      orchestrator['metrics']?.recordUpload(false);
    });
}

export class ThumbnailRenderOrchestrator {
  private completedCount = 0;
  private memoryCache = new MemoryUrlCache();

  // Generation counter: bumped when all caches are nuked.
  // Any thumbnail rendered before this generation is stale.
  private cacheGeneration = 0;
  // Track which generation each key was last rendered at
  private renderedGenerations = new Map<string, number>();

  constructor(
    private queue: ThumbnailRenderQueue,
    private renderer: ThumbnailRenderer,
    private localCache: ThumbnailLocalCache,
    private metrics?: ThumbnailMetricsCollector
  ) {}

  /**
   * Nuke every cache layer and force all subsequent requests to render fresh.
   * Call this from the admin "Clear Cloud Thumbnails" flow AFTER deleting
   * cloud files and local IndexedDB - this handles the remaining in-memory
   * layers (URL cache, knownExists, static manifest).
   */
  invalidateAllCaches(): void {
    this.cacheGeneration++;
    this.renderedGenerations.clear();
    this.memoryCache.clear();
    // Nuke in-memory URL cache + persistent "known exists" list
    cloudCacheModule.clearMemoryCache(true);
    // Reset static manifest so stale bundled thumbnails aren't served
    staticManifest = new Set();
  }

  getCached(hash: string): string | null {
    const lastRenderedGen = this.renderedGenerations.get(hash) ?? -1;
    if (lastRenderedGen < this.cacheGeneration) return null;
    return this.memoryCache.get(hash);
  }

  async getThumbnail(request: ThumbnailRequest): Promise<ThumbnailResult> {
    const key = keyDeriverModule.deriveKey(request.input);
    const cloudKey = this.buildCloudKey(key);

    // If all caches were nuked (admin clear), force skip for this key
    // until it's been freshly rendered in the current generation
    const lastRenderedGen = this.renderedGenerations.get(key.hash) ?? -1;
    const mustSkipCache = request.skipCache || lastRenderedGen < this.cacheGeneration;

    // Start metrics tracking
    const requestId = this.metrics?.startRequest(true) ?? "";

    // Step 0: In-memory URL cache (synchronous, zero latency)
    // Survives component remounts - eliminates placeholder flash on revisits
    if (!mustSkipCache) {
      const memUrl = this.memoryCache.get(key.hash);
      if (memUrl) {
        this.completedCount++;
        this.metrics?.endRequest(requestId, "memory");
        request.onStatusChange?.({ state: "complete", url: memUrl });
        return { url: memUrl, fromCache: true, key };
      }
    }

    // Step 1: Check STATIC bundled thumbnails (instant, no network latency)
    if (key.usesDefaults && !mustSkipCache) {
      const staticKey = this.buildStaticKey(key);
      const manifest = await getStaticManifest();

      if (manifest.has(staticKey)) {
        const staticUrl = `/thumbnails/${staticKey}.webp`;
        this.memoryCache.set(key.hash, staticUrl);
        this.renderedGenerations.set(key.hash, this.cacheGeneration);
        this.completedCount++;
        this.metrics?.endRequest(requestId, "static");
        request.onStatusChange?.({ state: "complete", url: staticUrl });
        return { url: staticUrl, fromCache: true, key };
      } else if (manifest.size > 0) {
        console.debug(`[Static] Not in manifest: "${staticKey}" (sequence: ${key.inputs.sequenceName})`);
      }
    }

    // Step 2: Check LOCAL IndexedDB cache (instant, personalized)
    if (!mustSkipCache) {
      const localBlob = await this.localCache.get(key.hash);
      if (localBlob) {
        const url = URL.createObjectURL(localBlob);
        this.memoryCache.set(key.hash, url);
        this.renderedGenerations.set(key.hash, this.cacheGeneration);
        this.completedCount++;
        this.metrics?.endRequest(requestId, "local");
        request.onStatusChange?.({ state: "complete", url });
        return { url, fromCache: true, key };
      }
    }

    // Step 3: Check cloud in-memory URL cache (instant, session-only)
    if (key.usesDefaults && !mustSkipCache) {
      const memoryCached = cloudCacheModule.getCachedUrl(cloudKey);
      if (memoryCached) {
        this.memoryCache.set(key.hash, memoryCached);
        this.renderedGenerations.set(key.hash, this.cacheGeneration);
        this.completedCount++;
        this.metrics?.endRequest(requestId, "cloud");
        request.onStatusChange?.({ state: "complete", url: memoryCached });
        return { url: memoryCached, fromCache: true, key };
      }

      // Step 4: Check cloud cache (network request)
      if (memoryCached === undefined) {
        request.onStatusChange?.({ state: "checking-cache" });
        const cloudUrl = await cloudCacheModule.getUrl(cloudKey, request.priority);
        if (cloudUrl) {
          this.saveCloudBlobToLocal(cloudUrl, key.hash);
          this.memoryCache.set(key.hash, cloudUrl);
          this.renderedGenerations.set(key.hash, this.cacheGeneration);
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
      return await this.queue.enqueue(key.hash, async (signal) => {
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
          },
          signal
        );

        const renderTime = performance.now() - renderStartTime;

        // Create blob URL for display
        const url = URL.createObjectURL(blob);

        // Save to local cache (for ALL thumbnails - instant next time)
        this.localCache.set(key.hash, blob).catch(() => {});

        // Upload to cloud (for default settings only - shared cache)
        if (key.usesDefaults) {
          uploadToCloud(this, key, blob);
        }

        // Store in memory cache for instant revisits
        this.memoryCache.set(key.hash, url);
        this.renderedGenerations.set(key.hash, this.cacheGeneration);
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
      // Use debug level for orphaned sequences (data issue, not bug) to reduce console noise
      const isOrphanedSequence = err.message.includes("ORPHANED_SEQUENCE");
      if (isOrphanedSequence) {
        console.debug(
          `[ThumbnailRenderOrchestrator] Orphaned sequence "${key.inputs.sequenceName}" - has no step data`
        );
      } else {
        console.warn(
          `[ThumbnailRenderOrchestrator] Failed to render "${key.inputs.sequenceName}":`,
          err.message
        );
      }
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

  buildCloudKey(key: ThumbnailCacheKey) {
    return {
      sequenceName: key.inputs.sequenceName,
      sequenceId: key.inputs.sequenceId,
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
  buildStaticKey(key: ThumbnailCacheKey): string {
    const modeSuffix = key.inputs.lightMode ? "_light" : "_dark";
    // Sanitize sequence name for Windows compatibility (colons from timestamps, etc.)
    const sanitizedName = key.inputs.sequenceName
      .replace(/:/g, "-")
      .replace(/[?<>"|*]/g, "_");
    return `${key.propKey}/${sanitizedName}${modeSuffix}`;
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
