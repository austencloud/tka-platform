/**
 * Background Video Encoder Contract
 *
 * Coordinates with a Web Worker to perform WebCodecs encoding off the main
 * thread. The main thread captures frames as ImageData and posts them to the
 * worker, which handles encoding and MP4 muxing without blocking the UI.
 */

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
   * Post a single frame to the worker for encoding.
   * The ImageData buffer is transferred (zero-copy) to avoid duplication.
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
