// src/lib/shared/video-export/services/contracts/ICanvasFrameCapturer.ts
import type { CapturedFrame } from "$lib/shared/video-export/domain/CapturedFrame";

/**
 * Canvas Frame Capturer
 *
 * Pulls a single frame from a canvas as the fastest transport form the
 * current browser supports. The returned CapturedFrame is the encoder's
 * input - the caller posts it through BackgroundVideoEncoder.addFrame()
 * which in turn transfers it to the encoding worker.
 *
 * Implementations must ensure the source canvas has flushed its current
 * draw before returning. For WebGL canvases the underlying context must
 * have preserveDrawingBuffer:true, otherwise the framebuffer is cleared
 * at presentation time and the capture returns black.
 */
export interface ICanvasFrameCapturer {
  /**
   * Which transport kind this capturer instance will produce at runtime,
   * chosen once at construction via capability detection.
   *
   * Exposed so callers and the encoder can telemeter or decide whether
   * to skip a wrap step. Callers that only consume the returned frame
   * do NOT need to branch on this value.
   */
  readonly preferredKind: "video-frame" | "image-data";

  /**
   * Capture a single frame from the given canvas.
   *
   * Synchronous by design: the underlying browser primitives
   * (`new VideoFrame(canvas)` and `CanvasRenderingContext2D.getImageData`)
   * both return immediately. Returning synchronously is load-bearing for
   * callers that need to preserve message ordering with the encoder worker
   * - a Promise-wrapped API would defer `addFrame` calls to microtasks and
   * could let a following `finish` message overtake them.
   *
   * @param canvas  The source canvas. Its width/height determine the
   *                captured frame dimensions.
   * @param timestampMicros  Presentation timestamp in microseconds. The
   *                         encoder uses this to order frames in the muxer.
   */
  capture(
    canvas: HTMLCanvasElement,
    timestampMicros: number
  ): CapturedFrame;
}
