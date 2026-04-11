/**
 * Background Video Encoder
 *
 * Delegates WebCodecs encoding and MP4 muxing to a dedicated Web Worker so the
 * main thread stays responsive during export. Communicates via structured
 * messages (see video-export.worker.ts for the protocol).
 *
 * Lifecycle:
 *   1. initialize() — spawns worker, posts config, waits for "ready"
 *   2. addFrame()   — posts ImageData (transferred, zero-copy) per frame
 *   3. finish()     — signals end, waits for completed MP4 ArrayBuffer
 *   4. cancel()     — aborts immediately and terminates the worker
 */

import type {
  BackgroundExportConfig,
  IBackgroundVideoEncoder,
} from "../contracts/IBackgroundVideoEncoder";
import type {
  ExportWorkerMessage,
  ExportWorkerResponse,
} from "../../workers/video-export.worker";
import type { CapturedFrame } from "$lib/shared/video-export/domain/CapturedFrame";

export class BackgroundVideoEncoder implements IBackgroundVideoEncoder {
  private worker: Worker | null = null;
  private totalFrames = 0;

  /**
   * Pending promise resolvers for request/response cycles.
   * Only one "initialize" and one "finish" can be in flight at a time.
   */
  private initResolve: (() => void) | null = null;
  private initReject: ((reason: Error) => void) | null = null;
  private finishResolve: ((blob: Blob) => void) | null = null;
  private finishReject: ((reason: Error) => void) | null = null;

  onProgress: ((frameIndex: number, totalFrames: number) => void) | null = null;

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  async initialize(config: BackgroundExportConfig): Promise<void> {
    // Terminate any leftover worker from a previous export
    this.terminateWorker();

    this.totalFrames = config.totalFrames;

    // Spawn the worker. Vite resolves the URL at build time via
    // `new URL("...", import.meta.url)` so the worker file is bundled correctly.
    this.worker = new Worker(
      new URL("../../workers/video-export.worker.ts", import.meta.url),
      { type: "module" }
    );

    this.worker.onmessage = this.handleMessage;
    this.worker.onerror = this.handleWorkerError;

    // Wait for the worker to finish configuring the encoder
    return new Promise<void>((resolve, reject) => {
      this.initResolve = resolve;
      this.initReject = reject;

      this.postToWorker({
        type: "config",
        config: {
          width: config.width,
          height: config.height,
          fps: config.fps,
          bitrate: config.bitrate,
          totalFrames: config.totalFrames,
        },
      });
    });
  }

  addFrame(
    imageData: ImageData,
    frameIndex: number,
    timestampMicros: number,
    isKeyframe: boolean
  ): void {
    if (!this.worker) {
      // Worker was disposed (e.g., viewer closed during export). The export
      // loop will check shouldCancel on the next iteration and abort cleanly.
      return;
    }

    // Transfer the underlying ArrayBuffer so it moves to the worker without
    // copying. After this call the ImageData on the main thread is neutered.
    const buffer = imageData.data.buffer;

    const message: ExportWorkerMessage = {
      type: "frame",
      imageData,
      frameIndex,
      timestampMicros,
      isKeyframe,
    };

    this.worker.postMessage(message, [buffer]);
  }

  addFrameCaptured(
    frame: CapturedFrame,
    frameIndex: number,
    isKeyframe: boolean
  ): void {
    if (!this.worker) {
      // Worker was disposed (e.g., viewer closed during export). The export
      // loop will check shouldCancel on the next iteration and abort cleanly.
      // Release the frame handle ourselves so it doesn't leak.
      if (frame.kind === "video-frame") {
        frame.frame.close();
      }
      return;
    }

    // Branch by kind so postMessage transferables are correct. The worker
    // closes every VideoFrame after encode(); we close here only when the
    // worker is unreachable (see early-return above).
    if (frame.kind === "video-frame") {
      this.worker.postMessage(
        {
          type: "frame-captured",
          frame,
          frameIndex,
          isKeyframe,
        },
        [frame.frame]
      );
    } else {
      // image-data: transfer the underlying ArrayBuffer.
      this.worker.postMessage(
        {
          type: "frame-captured",
          frame,
          frameIndex,
          isKeyframe,
        },
        [frame.data.data.buffer]
      );
    }
  }

  async finish(): Promise<Blob> {
    if (!this.worker) {
      throw new Error("Export cancelled");
    }

    return new Promise<Blob>((resolve, reject) => {
      this.finishResolve = resolve;
      this.finishReject = reject;

      this.postToWorker({ type: "finish" });
    });
  }

  cancel(): void {
    // Attempt to tell the worker to cancel gracefully first
    if (this.worker) {
      try {
        this.postToWorker({ type: "cancel" });
      } catch {
        // Worker may already be terminated
      }
    }

    // Reject any pending promises
    this.rejectPending(new Error("Export cancelled"));

    // Hard-terminate the worker
    this.terminateWorker();
  }

  // ---------------------------------------------------------------------------
  // Worker communication
  // ---------------------------------------------------------------------------

  private postToWorker(message: ExportWorkerMessage): void {
    this.worker?.postMessage(message);
  }

  private handleMessage = (event: MessageEvent<ExportWorkerResponse>): void => {
    const response = event.data;

    switch (response.type) {
      case "ready":
        this.initResolve?.();
        this.initResolve = null;
        this.initReject = null;
        break;

      case "progress":
        this.onProgress?.(response.frameIndex, this.totalFrames);
        break;

      case "complete": {
        const blob = new Blob([response.buffer], { type: "video/mp4" });

        this.finishResolve?.(blob);
        this.finishResolve = null;
        this.finishReject = null;

        // Export complete — clean up the worker
        this.terminateWorker();
        break;
      }

      case "error": {
        const error = new Error(response.error);

        // Route the error to whichever promise is currently in flight
        if (this.initReject) {
          this.initReject(error);
          this.initResolve = null;
          this.initReject = null;
        } else if (this.finishReject) {
          this.finishReject(error);
          this.finishResolve = null;
          this.finishReject = null;
        }
        break;
      }
    }
  };

  private handleWorkerError = (event: ErrorEvent): void => {
    const error = new Error(
      `Worker error: ${event.message || "Unknown worker error"}`
    );
    this.rejectPending(error);
    this.terminateWorker();
  };

  // ---------------------------------------------------------------------------
  // Cleanup helpers
  // ---------------------------------------------------------------------------

  private rejectPending(error: Error): void {
    if (this.initReject) {
      this.initReject(error);
      this.initResolve = null;
      this.initReject = null;
    }
    if (this.finishReject) {
      this.finishReject(error);
      this.finishResolve = null;
      this.finishReject = null;
    }
  }

  private terminateWorker(): void {
    if (this.worker) {
      this.worker.onmessage = null;
      this.worker.onerror = null;
      this.worker.terminate();
      this.worker = null;
    }
  }
}
