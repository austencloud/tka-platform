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

    // Show queued status (position is meaningless with priority sorting, so just show 0)
    request.onStatusChange?.({ state: "queued", position: 0 });

    // Queue the ENTIRE operation to prevent thundering herd
    // Priority: lower Y position = closer to top of viewport = higher priority
    try {
      return await this.queue.enqueue(key.hash, async () => {
        // Step 1: Check in-memory cache only (no network request = no 404s)
        // Cloud check is skipped to avoid 404 spam - we still upload for future users
        if (key.usesDefaults && !request.skipCache) {
          const cachedUrl = this.cloudCache.getCachedUrl(this.buildCloudKey(key));
          if (cachedUrl) {
            this.completedCount++;
            request.onStatusChange?.({ state: "complete", url: cachedUrl });
            return { url: cachedUrl, fromCache: true, key };
          }
          // If cachedUrl is null (checked before, doesn't exist) or undefined (never checked),
          // proceed to render locally. Skip cloud check to avoid 404 noise.
        }

        // Step 2: Render locally
        request.onStatusChange?.({ state: "rendering" });
        const blob = await this.renderer.render(request.sequence, key.inputs);

        // Step 3: Create blob URL for display
        const url = URL.createObjectURL(blob);

        // Step 4: Upload to cloud (for default settings, async/non-blocking)
        if (key.usesDefaults) {
          // Don't show uploading state - it happens in background after image is displayed
          this.uploadToCloud(key, blob);
        }

        this.completedCount++;
        request.onStatusChange?.({ state: "complete", url });

        return { url, fromCache: false, key };
      }, request.priority);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      // Check if cancelled (not a real error)
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
