/**
 * Realtime 3D Exporter
 *
 * Captures frames from a live WebGL canvas during real-time playback and
 * encodes them to MP4 via the BackgroundVideoEncoder. The animation runs at
 * normal speed; this exporter samples at the target FPS using
 * requestAnimationFrame timing, scales each frame to the export resolution
 * on an offscreen canvas, and posts ImageData to the encoder worker.
 */

import type { IBackgroundVideoEncoder } from "$lib/features/compose/services/contracts/IBackgroundVideoEncoder";
import type { VideoExportProgress } from "$lib/features/compose/services/contracts/IVideoExportOrchestrator";
import type {
  IRealtime3DExporter,
  Realtime3DExportOptions,
} from "../contracts/IRealtime3DExporter";
import {
  getExportDimensions,
  calculateBitrate,
} from "$lib/features/compose/shared/domain/video-export-calculations";
import type { ICanvasFrameCapturer } from "$lib/shared/video-export/services/contracts/ICanvasFrameCapturer";

/** Keyframe interval — emit a keyframe every N frames for seek performance. */
const KEYFRAME_INTERVAL = 30;

/** Fallback aspect ratio if the live canvas has zero size at capture time. */
const FALLBACK_ASPECT_RATIO = 16 / 9;

export class Realtime3DExporter implements IRealtime3DExporter {
  private shouldCancel = false;
  private rafHandle: number | null = null;

  constructor(
    private readonly backgroundEncoder: IBackgroundVideoEncoder,
    private readonly capturer: ICanvasFrameCapturer
  ) {}

  async export3D(
    webglCanvas: HTMLCanvasElement,
    startPlayback: () => void,
    stopPlayback: () => void,
    getTotalDurationSeconds: () => number,
    onProgress: (progress: VideoExportProgress) => void,
    options: Realtime3DExportOptions
  ): Promise<Blob> {
    this.shouldCancel = false;

    const { fps, resolution, loopCount } = options;

    // Derive aspect ratio from the live WebGL canvas so the exported video
    // preserves whatever shape the user actually sees. `canvas.width/height`
    // is the backing store set by the renderer (honors DPR), which is the
    // true shape of the rendered image. Hardcoding a square here was the
    // reason exported videos came out smushed whenever the 3D viewer was
    // resized wider than tall.
    const liveWidth = webglCanvas.width;
    const liveHeight = webglCanvas.height;
    const aspectRatio =
      liveWidth > 0 && liveHeight > 0
        ? liveWidth / liveHeight
        : FALLBACK_ASPECT_RATIO;

    const { width, height } = getExportDimensions(resolution, aspectRatio);
    const bitrate = calculateBitrate(width, height, fps);

    // Total duration accounts for loop count. The caller's getTotalDurationSeconds
    // already factors in start position and end hold based on the options.
    const totalDurationSec = getTotalDurationSeconds() * loopCount;
    const totalFrames = Math.ceil(totalDurationSec * fps);

    if (totalFrames <= 0) {
      throw new Error(
        `Cannot export: computed 0 frames (duration=${totalDurationSec}s, fps=${fps})`
      );
    }

    // Initialize the background encoder (spins up the Web Worker)
    await this.backgroundEncoder.initialize({
      width,
      height,
      fps,
      bitrate,
      totalFrames,
    });

    // Wire encoder progress into our progress callback
    this.backgroundEncoder.onProgress = (frameIndex, total) => {
      onProgress({
        progress: frameIndex / total,
        stage: "encoding",
        currentFrame: frameIndex,
        totalFrames: total,
      });
    };

    // Offscreen canvas for scaling WebGL frames to export resolution
    const offscreen = document.createElement("canvas");
    offscreen.width = width;
    offscreen.height = height;
    const offCtx = offscreen.getContext("2d", { willReadFrequently: true });
    if (!offCtx) {
      throw new Error("Failed to create 2D context for export scaling canvas");
    }

    // Begin the real-time animation
    startPlayback();

    // Capture loop using requestAnimationFrame
    const frameDurationMs = 1000 / fps;
    let frameIndex = 0;
    let startTime: number | null = null;

    return new Promise<Blob>((resolve, reject) => {
      const captureFrame = (timestamp: number) => {
        if (this.shouldCancel) {
          stopPlayback();
          reject(new Error("Export cancelled"));
          return;
        }

        if (startTime === null) {
          startTime = timestamp;
        }

        const elapsedMs = timestamp - startTime;
        const expectedFrame = Math.floor(elapsedMs / frameDurationMs);

        // Capture all frames we've fallen behind on (typically just one)
        while (frameIndex <= expectedFrame && frameIndex < totalFrames) {
          // Draw the WebGL canvas onto the offscreen canvas at export resolution.
          // The WebGL canvas preserveDrawingBuffer should be true for this to work
          // reliably; the caller is responsible for that configuration.
          // Scale the live WebGL canvas onto the offscreen canvas at the
          // export resolution. This is a GPU-accelerated canvas→canvas
          // blit; the expensive step was the following pixel readback,
          // which we now skip entirely by handing the offscreen canvas to
          // the capturer as a zero-copy handle.
          offCtx.drawImage(webglCanvas, 0, 0, width, height);

          const timestampMicros = Math.round((frameIndex / fps) * 1_000_000);
          const isKeyframe = frameIndex % KEYFRAME_INTERVAL === 0;

          // Freeze the current frameIndex into a local so the capture
          // promise resolves against the correct index even after the
          // RAF loop has incremented frameIndex below.
          const capturedIndex = frameIndex;

          // Fire-and-forget capture. On the VideoFrame path the promise
          // is effectively already-resolved — `new VideoFrame(canvas)` is
          // a synchronous constructor and the async wrapper in the
          // ICanvasFrameCapturer interface exists only for symmetry with
          // the ImageData fallback (whose `getImageData` is also synchronous
          // in practice). Frame ordering is preserved because postMessage
          // is synchronous and the worker processes messages in arrival
          // order, so fire-and-forget is safe here.
          //
          // We deliberately do NOT await inside the RAF tick. Awaiting
          // would push the next RAF callback past the next vsync and
          // drift the capture out of lockstep with live playback.
          void this.capturer
            .capture(offscreen, timestampMicros)
            .then((frame) => {
              this.backgroundEncoder.addFrameCaptured(
                frame,
                capturedIndex,
                isKeyframe
              );
            });

          onProgress({
            progress: frameIndex / totalFrames,
            stage: "capturing",
            currentFrame: frameIndex,
            totalFrames,
          });

          frameIndex++;
        }

        if (frameIndex >= totalFrames) {
          // All frames captured — stop playback and finalize
          stopPlayback();
          this.backgroundEncoder
            .finish()
            .then((blob) => {
              onProgress({ progress: 1, stage: "complete", totalFrames });
              resolve(blob);
            })
            .catch((err) => {
              onProgress({
                progress: 0,
                stage: "error",
                error: err instanceof Error ? err.message : String(err),
              });
              reject(err);
            });
          return;
        }

        this.rafHandle = requestAnimationFrame(captureFrame);
      };

      this.rafHandle = requestAnimationFrame(captureFrame);
    });
  }

  cancel(): void {
    this.shouldCancel = true;

    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }

    this.backgroundEncoder.cancel();
  }
}
