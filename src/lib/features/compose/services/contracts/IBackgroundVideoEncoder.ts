/**
 * Background Video Encoder Contract
 *
 * Coordinates with a Web Worker to perform WebCodecs encoding off the main
 * thread. The main thread captures frames and posts them to the worker,
 * which handles encoding and MP4 muxing without blocking the UI.
 */

import type { CapturedFrame } from "$lib/shared/video-export/domain/CapturedFrame";

export interface BackgroundExportConfig {
  width: number;
  height: number;
  fps: number;
  bitrate: number;
  totalFrames: number;
}

export interface IBackgroundVideoEncoder {
  /**
   * Spin up the worker and configure the encoder/muxer.
   * Resolves once the worker reports "ready".
   */
  initialize(config: BackgroundExportConfig): Promise<void>;

  /**
   * Post a pre-captured frame (VideoFrame or ImageData) to the worker
   * for encoding. The underlying transferable handle is transferred
   * zero-copy; the caller must not touch the frame after this call.
   *
   * This is the preferred path. `addFrame` (legacy) will be removed
   * after both export pipelines migrate.
   */
  addFrameCaptured(
    frame: CapturedFrame,
    frameIndex: number,
    isKeyframe: boolean
  ): void;

  /**
   * Legacy: post a single ImageData frame to the worker. The underlying
   * buffer is transferred zero-copy. Preserved during migration — new
   * call sites MUST use `addFrameCaptured`.
   *
   * @deprecated Use addFrameCaptured. Will be removed after the 2D and
   *             3D exporters migrate.
   */
  addFrame(
    imageData: ImageData,
    frameIndex: number,
    timestampMicros: number,
    isKeyframe: boolean
  ): void;

  /**
   * Signal that all frames have been sent. Resolves with the finished
   * MP4 blob once the worker flushes the encoder and finalizes the muxer.
   */
  finish(): Promise<Blob>;

  /**
   * Cancel the in-progress export and terminate the worker immediately.
   */
  cancel(): void;

  /**
   * Optional progress callback invoked each time the worker finishes
   * encoding a frame.
   */
  onProgress: ((frameIndex: number, totalFrames: number) => void) | null;
}
