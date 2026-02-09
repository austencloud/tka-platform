/**
 * IVideoFrameExtractor - Extract ImageData frames from a video file
 *
 * Uses a hidden video element + canvas to seek through a video file
 * and extract frames at a configurable sample rate.
 */

import type { ExtractedFrame, ProgressCallback } from "../../domain/models";

export interface FrameExtractionOptions {
  /** Frames per second to extract (default: 15) */
  fps?: number;
  /** Maximum number of frames to extract (default: unlimited) */
  maxFrames?: number;
}

export interface IVideoFrameExtractor {
  /**
   * Extract frames from a video file as ImageData.
   *
   * Creates a hidden video element, seeks frame-by-frame,
   * and draws each frame to an offscreen canvas to get ImageData.
   *
   * @param file - The video file (from file input or drag-drop)
   * @param options - Extraction configuration
   * @param onProgress - Progress callback (current frame, total frames)
   * @returns Array of extracted frames with timestamps
   */
  extractFrames(
    file: File,
    options?: FrameExtractionOptions,
    onProgress?: ProgressCallback
  ): Promise<ExtractedFrame[]>;
}
