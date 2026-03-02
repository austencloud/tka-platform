/// <reference lib="webworker" />

/**
 * Video Export Web Worker
 *
 * Offloads WebCodecs encoding and MP4 muxing to a background thread so the
 * main thread stays responsive during export. Mirrors the codec selection,
 * keyframe interval, and timestamp handling from WebCodecsVideoEncoder.ts.
 *
 * Communication protocol uses structured messages (see ExportWorkerMessage /
 * ExportWorkerResponse types below). The final MP4 ArrayBuffer is transferred
 * (zero-copy) back to the main thread.
 */

import { Muxer, ArrayBufferTarget } from "mp4-muxer";

// ---------------------------------------------------------------------------
// Message types -- IN (main thread -> worker)
// ---------------------------------------------------------------------------

interface ConfigMessage {
  type: "config";
  config: ExportConfig;
}

interface FrameMessage {
  type: "frame";
  imageData: ImageData;
  frameIndex: number;
  timestampMicros: number;
  isKeyframe: boolean;
}

interface FinishMessage {
  type: "finish";
}

interface CancelMessage {
  type: "cancel";
}

export type ExportWorkerMessage =
  | ConfigMessage
  | FrameMessage
  | FinishMessage
  | CancelMessage;

// ---------------------------------------------------------------------------
// Message types -- OUT (worker -> main thread)
// ---------------------------------------------------------------------------

interface ReadyResponse {
  type: "ready";
}

interface ProgressResponse {
  type: "progress";
  frameIndex: number;
}

interface CompleteResponse {
  type: "complete";
  buffer: ArrayBuffer;
}

interface ErrorResponse {
  type: "error";
  error: string;
}

export type ExportWorkerResponse =
  | ReadyResponse
  | ProgressResponse
  | CompleteResponse
  | ErrorResponse;

// ---------------------------------------------------------------------------
// Export configuration
// ---------------------------------------------------------------------------

export interface ExportConfig {
  width: number;
  height: number;
  fps: number;
  bitrate: number;
  totalFrames: number;
}

// ---------------------------------------------------------------------------
// Worker state
// ---------------------------------------------------------------------------

let encoder: VideoEncoder | null = null;
let muxer: Muxer<ArrayBufferTarget> | null = null;
let cancelled = false;
let frameDurationMicros = 0;
let encoderWidth = 0;
let encoderHeight = 0;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Choose H.264 codec string based on pixel area.
 *
 * Uses Baseline Profile (42) which has the widest hardware support.
 *   - Level 3.1 (0x1f): up to 921,600 px (e.g. 1280x720)
 *   - Level 4.0 (0x28): up to 2,073,600 px (e.g. 1920x1080)
 *   - Level 5.1 (0x33): up to 8,912,896 px (e.g. 4096x2160)
 */
function selectCodec(width: number, height: number): string {
  const pixelArea = width * height;
  if (pixelArea <= 921_600) return "avc1.42001f";
  if (pixelArea <= 2_073_600) return "avc1.420028";
  return "avc1.420033";
}

/**
 * Round a dimension up to the nearest even number.
 * H.264 requires even width and height.
 */
function ensureEven(value: number): number {
  const rounded = Math.round(value);
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

/**
 * Post a response back to the main thread.
 * For "complete" messages, the buffer is transferred (zero-copy) rather than
 * copied, which avoids duplicating potentially large MP4 data in memory.
 */
function post(response: ExportWorkerResponse): void {
  const scope = self as DedicatedWorkerGlobalScope;

  if (response.type === "complete") {
    scope.postMessage(response, [response.buffer]);
  } else {
    scope.postMessage(response);
  }
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

function cleanup(): void {
  if (encoder) {
    try {
      encoder.close();
    } catch {
      // Encoder may already be closed or in error state
    }
    encoder = null;
  }
  muxer = null;
  frameDurationMicros = 0;
  encoderWidth = 0;
  encoderHeight = 0;
}

// ---------------------------------------------------------------------------
// Message handlers
// ---------------------------------------------------------------------------

async function handleConfig(config: ExportConfig): Promise<void> {
  cancelled = false;

  // Clean up any leftover state from a previous (possibly cancelled) export
  cleanup();

  encoderWidth = ensureEven(config.width);
  encoderHeight = ensureEven(config.height);
  frameDurationMicros = Math.round(1_000_000 / config.fps);

  // Create MP4 muxer with in-memory fast-start for instant playback
  muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: {
      codec: "avc",
      width: encoderWidth,
      height: encoderHeight,
    },
    fastStart: "in-memory",
  });

  const localMuxer = muxer;

  // Create WebCodecs VideoEncoder
  encoder = new VideoEncoder({
    output: (chunk, meta) => {
      localMuxer.addVideoChunk(chunk, meta);
    },
    error: (e) => {
      post({
        type: "error",
        error: `VideoEncoder error: ${e.message}`,
      });
    },
  });

  const codec = selectCodec(encoderWidth, encoderHeight);

  await encoder.configure({
    codec,
    width: encoderWidth,
    height: encoderHeight,
    bitrate: config.bitrate,
    framerate: config.fps,
  });

  post({ type: "ready" });
}

function handleFrame(msg: FrameMessage): void {
  if (cancelled || !encoder) return;

  // If the source dimensions differ from the encoder dimensions (odd -> even
  // rounding), create a new ImageData with the padded size. Extra pixels are
  // black (zeroed), matching the existing resize-canvas approach on main thread.
  let frameData: ImageData = msg.imageData;
  if (
    encoderWidth !== msg.imageData.width ||
    encoderHeight !== msg.imageData.height
  ) {
    frameData = new ImageData(encoderWidth, encoderHeight);
    const src = msg.imageData.data;
    const dst = frameData.data;
    const srcRowBytes = msg.imageData.width * 4;
    const dstRowBytes = encoderWidth * 4;
    for (let row = 0; row < msg.imageData.height; row++) {
      dst.set(
        src.subarray(row * srcRowBytes, row * srcRowBytes + srcRowBytes),
        row * dstRowBytes
      );
    }
  }

  // Create VideoFrame from the (possibly padded) ImageData.
  // Timestamp comes from the main thread; duration from the configured fps.
  const frame = new VideoFrame(frameData, {
    timestamp: msg.timestampMicros,
    duration: frameDurationMicros,
  });

  encoder.encode(frame, { keyFrame: msg.isKeyframe });

  // Close immediately to free GPU/memory resources
  frame.close();

  post({ type: "progress", frameIndex: msg.frameIndex });
}

async function handleFinish(): Promise<void> {
  if (cancelled || !encoder || !muxer) {
    post({ type: "error", error: "Cannot finish: encoder not active" });
    return;
  }

  try {
    // Flush all remaining frames through the encoder pipeline
    await encoder.flush();

    // Finalize the MP4 container (writes moov atom)
    muxer.finalize();

    // Extract the completed buffer
    const buffer = muxer.target.buffer;

    // Clean up encoder/muxer state before posting
    cleanup();

    // Transfer (zero-copy) the buffer back to the main thread
    post({ type: "complete", buffer });
  } catch (e) {
    cleanup();
    const message = e instanceof Error ? e.message : String(e);
    post({ type: "error", error: `Finish failed: ${message}` });
  }
}

function handleCancel(): void {
  cancelled = true;
  cleanup();
}

// ---------------------------------------------------------------------------
// Main message listener
// ---------------------------------------------------------------------------

self.onmessage = async (event: MessageEvent<ExportWorkerMessage>) => {
  const msg = event.data;

  try {
    switch (msg.type) {
      case "config":
        await handleConfig(msg.config);
        break;

      case "frame":
        handleFrame(msg);
        break;

      case "finish":
        await handleFinish();
        break;

      case "cancel":
        handleCancel();
        break;

      default:
        post({
          type: "error",
          error: `Unknown message type: ${(msg as { type: string }).type}`,
        });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    post({ type: "error", error: message });
  }
};
