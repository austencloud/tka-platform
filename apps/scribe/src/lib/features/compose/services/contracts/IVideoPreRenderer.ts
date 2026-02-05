/**
 * IVideoPreRenderer
 *
 * Pre-renders animation sequences to video for reliable, smooth playback.
 * Eliminates coordinate transformation issues by capturing exactly what's rendered.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export interface VideoRenderProgress {
  /** Current frame being rendered */
  currentFrame: number;
  /** Total frames to render */
  totalFrames: number;
  /** Progress percentage (0-100) */
  percent: number;
  /** Estimated time remaining in ms */
  estimatedTimeRemaining: number;
  /** Current phase: 'rendering' | 'encoding' | 'complete' */
  phase: "rendering" | "encoding" | "complete";
}

export interface VideoRenderResult {
  /** Whether rendering succeeded */
  success: boolean;
  /** Video blob (if successful) */
  videoBlob?: Blob;
  /** Blob URL for playback (if successful) */
  blobUrl?: string;
  /** Video duration in seconds */
  duration?: number;
  /** Error message (if failed) */
  error?: string;
  /** Sequence ID this video was generated for */
  sequenceId: string;
}

export interface VideoRenderOptions {
  /** Target FPS for the video (default: 60) */
  fps?: number;
  /** Video width in pixels (default: canvas size) */
  width?: number;
  /** Video height in pixels (default: canvas size) */
  height?: number;
  /** Playback speed multiplier (default: 1) */
  speed?: number;
  /** Whether to include trails in the render */
  includeTrails?: boolean;
  /** Video format: 'webm' or 'mp4' (default: 'webm') */
  format?: "webm" | "mp4";
  /** Video quality (0-1, default: 0.9) */
  quality?: number;
}

export interface IVideoPreRenderer {
  /**
   * Pre-render a sequence to video
   *
   * @param sequence - The sequence to render
   * @param canvas - The canvas element to capture from
   * @param options - Render options
   * @param onProgress - Progress callback
   * @returns Promise resolving to render result
   */
  renderSequenceToVideo(
    sequence: SequenceData,
    canvas: HTMLCanvasElement,
    options?: VideoRenderOptions,
    onProgress?: (progress: VideoRenderProgress) => void
  ): Promise<VideoRenderResult>;

  /**
   * Check if a video exists in cache for a sequence
   *
   * @param sequenceId - Unique sequence identifier
   * @returns Promise resolving to cached video info or null
   */
  getCachedVideo(sequenceId: string): Promise<VideoRenderResult | null>;

  /**
   * Store a rendered video in cache
   *
   * @param sequenceId - Unique sequence identifier
   * @param videoBlob - The video blob to cache
   */
  cacheVideo(sequenceId: string, videoBlob: Blob): Promise<void>;

  /**
   * Clear cached video for a sequence
   *
   * @param sequenceId - Unique sequence identifier
   */
  clearCachedVideo(sequenceId: string): Promise<void>;

  /**
   * Clear all cached videos
   */
  clearAllCachedVideos(): Promise<void>;

  /**
   * Cancel ongoing render
   */
  cancelRender(): void;

  /**
   * Check if a render is in progress
   */
  isRendering(): boolean;
}
