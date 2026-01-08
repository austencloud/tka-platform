/**
 * ThumbnailRenderOrchestrator
 *
 * Coordinates the thumbnail loading pipeline:
 * 1. Derive cache key from inputs
 * 2. Check cloud cache (instant if hit)
 * 3. Queue render (throttled, max 3 concurrent)
 * 4. Render locally
 * 5. Upload to cloud (async, for next user)
 *
 * This is the main entry point for components.
 */

import { inject, injectable } from "inversify";
import { TYPES } from "$lib/shared/inversify/types";
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

@injectable()
export class ThumbnailRenderOrchestrator implements IThumbnailRenderOrchestrator {
  private completedCount = 0;

  constructor(
    @inject(TYPES.IThumbnailKeyDeriver)
    private keyDeriver: IThumbnailKeyDeriver,
    @inject(TYPES.IThumbnailRenderQueue)
    private queue: IThumbnailRenderQueue,
    @inject(TYPES.IThumbnailRenderer)
    private renderer: IThumbnailRenderer,
    @inject(TYPES.ICloudThumbnailCache)
    private cloudCache: ICloudThumbnailCache
  ) {}

  async getThumbnail(request: ThumbnailRequest): Promise<ThumbnailResult> {
    const key = this.keyDeriver.deriveKey(request.input);
    const cloudKey = this.buildCloudKey(key);

    // Step 1: Check in-memory cache FIRST (instant, no network)
    if (key.usesDefaults && !request.skipCache) {
      const memoryCached = this.cloudCache.getCachedUrl(cloudKey);
      if (memoryCached) {
        // Instant return - URL is in memory
        this.completedCount++;
        request.onStatusChange?.({ state: "complete", url: memoryCached });
        return { url: memoryCached, fromCache: true, key };
      }

      // Step 2: If not in memory, check cloud cache (network request)
      // This runs BEFORE queueing so cached items don't wait in line
      // Priority ensures visible thumbnails are checked first
      if (memoryCached === undefined) {
        // undefined = never checked; null = checked and doesn't exist
        request.onStatusChange?.({ state: "checking-cache" });
        const cloudUrl = await this.cloudCache.getUrl(cloudKey, request.priority);
        if (cloudUrl) {
          // Found in cloud - instant return
          this.completedCount++;
          request.onStatusChange?.({ state: "complete", url: cloudUrl });
          return { url: cloudUrl, fromCache: true, key };
        }
        // Not in cloud - will need to render (cached as null, won't check again)
      }
    }

    // Step 3: Need to render - queue to throttle concurrent renders
    request.onStatusChange?.({ state: "queued", position: 0 });

    try {
      return await this.queue.enqueue(key.hash, async () => {
        // Render locally
        request.onStatusChange?.({ state: "rendering" });
        const blob = await this.renderer.render(request.sequence, key.inputs);

        // Create blob URL for display
        const url = URL.createObjectURL(blob);

        // Upload to cloud (for default settings, async/non-blocking)
        if (key.usesDefaults) {
          this.uploadToCloud(key, blob);
        }

        this.completedCount++;
        request.onStatusChange?.({ state: "complete", url });

        return { url, fromCache: false, key };
      }, request.priority);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      if (err.message === "Cancelled") {
        throw err;
      }

      request.onStatusChange?.({ state: "error", error: err });
      throw err;
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

  private uploadToCloud(key: ThumbnailCacheKey, blob: Blob): void {
    this.cloudCache
      .upload(this.buildCloudKey(key), blob)
      .catch(() => {
        // Non-fatal - image is displayed, just couldn't upload for others
      });
  }
}
