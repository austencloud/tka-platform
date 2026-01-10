/**
 * IThumbnailRenderOrchestrator
 *
 * Coordinates the thumbnail loading pipeline:
 * 1. Check cloud cache (instant if hit)
 * 2. Queue render (throttled, max 3 concurrent)
 * 3. Render locally
 * 4. Upload to cloud (async, for next user)
 *
 * This is the main entry point for components.
 * Composes: IThumbnailKeyDeriver, IThumbnailRenderQueue, IThumbnailRenderer, ICloudThumbnailCache
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { ThumbnailRenderInput, ThumbnailCacheKey } from "./IThumbnailKeyDeriver";

/**
 * Status updates during thumbnail loading.
 * Components can use this to show appropriate UI states.
 */
export type ThumbnailLoadStatus =
  | { state: "idle" }
  | { state: "checking-cache" }
  | { state: "queued"; position: number }
  | { state: "rendering" }
  | { state: "uploading" }
  | { state: "complete"; url: string }
  | { state: "error"; error: Error };

/**
 * Request to load/render a thumbnail.
 */
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

/**
 * Result of a thumbnail load/render operation.
 */
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

export interface IThumbnailRenderOrchestrator {
  /**
   * Get or create a thumbnail for the given sequence and inputs.
   *
   * Flow:
   * 1. Derive cache key from inputs
   * 2. Check cloud cache (if using default settings)
   * 3. If miss, queue render (throttled)
   * 4. Render locally
   * 5. Upload to cloud (async, non-blocking)
   * 6. Return URL
   *
   * @param request The sequence and render configuration
   * @returns Promise with the thumbnail URL and metadata (url is null if render failed)
   */
  getThumbnail(request: ThumbnailRequest): Promise<ThumbnailResult>;

  /**
   * Cancel any pending render for this key.
   * Call when component unmounts or inputs change.
   *
   * @param key The cache key (or just { hash: string })
   */
  cancel(key: Pick<ThumbnailCacheKey, "hash">): void;

  /**
   * Cancel all pending renders.
   * Call on bulk changes (light mode toggle) to clear queue before re-queuing.
   */
  cancelAll(): void;

  /**
   * Get current queue statistics.
   * Useful for debugging and progress display.
   */
  getQueueStats(): { queued: number; active: number; completed: number };
}
