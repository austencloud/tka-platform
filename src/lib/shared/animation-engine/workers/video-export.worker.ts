/// <reference lib="webworker" />

/**
 * Video Export Web Worker
 *
 * Offloads video encoding and MP4 muxing to a background thread so the main
 * thread stays responsive during export.
 *
 * Two encoding paths:
 *   1. WebCodecs (Chrome, Edge, Safari 16.4+) -- hardware-accelerated H.264
 *      via VideoEncoder + mediabunny.
 *   2. WASM fallback (Firefox, older browsers) -- h264-mp4-encoder provides
 *      a pure-WASM H.264 encoder that produces MP4 directly.
 *
 * The path is chosen at config time based on whether VideoEncoder exists in
 * the worker global scope. Both paths post identical message types back to
 * the main thread (ready, progress, complete, error).
 */

import { Output, Mp4OutputFormat, BufferTarget, EncodedVideoPacketSource, EncodedPacket } from "mediabunny";
import type { CapturedFrame } from "$lib/shared/video-export/domain/captured-frame";

// ---------------------------------------------------------------------------
// WebCodecs feature detection
// ---------------------------------------------------------------------------

const hasWebCodecs = typeof VideoEncoder !== "undefined";

// Mobile GPUs (Qualcomm/Mali/Apple) reliably silicon-accelerate H.264
// Constrained Baseline; many do NOT accelerate High and silently fall back to
// a software path, which on phones encodes at ~0.5fps. Desktop Windows Media
// Foundation is the opposite — it accelerates Main/High, not Baseline. So pick
// the profile by platform.
const IS_MOBILE = (() => {
  try {
    const nav = (self as unknown as { navigator?: Navigator & { userAgentData?: { mobile?: boolean; platform?: string } } }).navigator;
    const ua = nav?.userAgent ?? "";
    const platform = nav?.userAgentData?.platform ?? "";
    const isAndroid = /Android/i.test(ua) || platform === "Android";
    const isApple = /iPhone|iPad|iPod/i.test(ua) || platform === "iOS";
    return isAndroid || isApple || nav?.userAgentData?.mobile === true;
  } catch {
    return false;
  }
})();

// ---------------------------------------------------------------------------
// h264-mp4-encoder type (mirrors WasmVideoEncoder.ts)
// ---------------------------------------------------------------------------

type H264MP4Encoder = {
  width: number;
  height: number;
  frameRate: number;
  kbps: number;
  groupOfPictures: number;
  quantizationParameter: number;
  initialize: () => void;
  addFrameRgba: (data: Uint8ClampedArray) => void;
  finalize: () => void;
  FS: { readFile: (filename: string) => Uint8Array };
  outputFilename: string;
  delete: () => void;
};

// ---------------------------------------------------------------------------
// Message types -- IN (main thread -> worker)
// ---------------------------------------------------------------------------

interface ConfigMessage {
  type: "config";
  config: ExportConfig;
}

interface FrameMessageLegacy {
  type: "frame";
  imageData: ImageData;
  frameIndex: number;
  timestampMicros: number;
  isKeyframe: boolean;
}

interface FrameMessageCaptured {
  type: "frame-captured";
  frame: CapturedFrame;
  frameIndex: number;
  isKeyframe: boolean;
}

type FrameMessage = FrameMessageLegacy | FrameMessageCaptured;

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
  /**
   * Video codec. "h264" (default) = H.264 High profile, 4:2:0 — max
   * compatibility but chroma-subsampled (fringes saturated edges on black).
   * "av1" = AV1 High profile (4:4:4), no chroma subsampling — eliminates the
   * edge/gradient fringe for near-exact parity with the on-screen render, at
   * the cost of slower (often software) encode. WebCodecs path only.
   */
  codec?: "h264" | "av1";
  /**
   * When true, mux fragmented MP4 (moof fragments) instead of progressive
   * (moov+mdat). Fragmented MP4 is appendable to a MediaSource SourceBuffer,
   * enabling gap-free MSE looping. Default false (progressive, max-compat).
   */
  fragmented?: boolean;
}

// ---------------------------------------------------------------------------
// Worker state -- WebCodecs path
// ---------------------------------------------------------------------------

let encoder: VideoEncoder | null = null;
let output: Output | null = null;
let videoSource: EncodedVideoPacketSource | null = null;

// ---------------------------------------------------------------------------
// Worker state -- WASM fallback path
// ---------------------------------------------------------------------------

let wasmEncoder: H264MP4Encoder | null = null;

// ---------------------------------------------------------------------------
// Worker state -- shared
// ---------------------------------------------------------------------------

let cancelled = false;
let encoderErrored = false;
/**
 * Frames actually through the encoder and into the muxer, which is NOT the
 * number received. `encoder.encode()` only queues; with `latencyMode:"quality"`
 * the queue runs thousands deep and drains inside `flush()`. Reporting receipts
 * as progress made the readout hit 100% while most of the work was still
 * pending, so the last minutes of a long export looked like a frozen "Frame N
 * of N" — a 73s take measured 189s between `finish` and `complete` with the
 * counter parked at the end the whole time. Count what has landed instead.
 */
let encodedFrames = 0;
let frameDurationMicros = 0;
let encoderWidth = 0;
let encoderHeight = 0;
let sourceWidth = 0; // eslint-disable-line @typescript-eslint/no-unused-vars
let sourceHeight = 0; // eslint-disable-line @typescript-eslint/no-unused-vars

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * H.264 codec string. Profile prefix tracks the platform's HW path:
 * mobile GPUs accelerate Constrained Baseline (0x42e0), desktop Media
 * Foundation accelerates High (0x6400). Level byte tracks resolution.
 *   - Level 3.1 (0x1f): up to 921,600 px (e.g. 1280x720)
 *   - Level 4.0 (0x28): up to 2,073,600 px (e.g. 1920x1080)
 *   - Level 5.1 (0x33): up to 8,912,896 px (e.g. 4096x2160)
 *   - Level 6.0 (0x3c): up to 35,651,584 px (e.g. 8192x4320)
 */
export function selectCodec(width: number, height: number, isMobile: boolean = IS_MOBILE): string {
  const pixelArea = width * height;
  const level = pixelArea <= 921_600 ? "1f"
    : pixelArea <= 2_073_600 ? "28"
    : pixelArea <= 8_912_896 ? "33"
    : "3c";
  return isMobile ? `avc1.42e0${level}` : `avc1.6400${level}`;
}

/**
 * AV1 High profile (profile 1) = 4:4:4, no chroma subsampling, so saturated
 * red/blue edges and soft glow gradients survive intact — the lever for
 * near-exact parity. seq_level_idx scales with resolution (08=4.0 covers 1080p,
 * 13=5.1 covers 4K, 16=6.0 for 8K). `bitDepth` is "10" for max fidelity (10-bit
 * reconstruction kills the encoder-introduced banding/quantization noise on the
 * near-black background gradient) with "08" as the fallback for platforms whose
 * AV1 encoder can't do 10-bit.
 */
function selectCodecAv1(
  width: number,
  height: number,
  bitDepth: "08" | "10" = "10",
): string {
  const pixelArea = width * height;
  if (pixelArea <= 2_073_600) return `av01.1.08M.${bitDepth}`;
  if (pixelArea <= 8_912_896) return `av01.1.13M.${bitDepth}`;
  return `av01.1.16M.${bitDepth}`;
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
 * Pad RGBA pixel data from source dimensions to encoder dimensions.
 * Extra pixels are filled with opaque black (0, 0, 0, 255).
 * Returns the original data if no padding is needed.
 */
function padRgbaData(
  src: Uint8ClampedArray,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number
): Uint8ClampedArray {
  if (srcW === dstW && srcH === dstH) return src;

  const dst = new Uint8ClampedArray(dstW * dstH * 4);

  // Copy source rows into the padded buffer
  const srcRowBytes = srcW * 4;
  const dstRowBytes = dstW * 4;
  for (let row = 0; row < srcH; row++) {
    dst.set(
      src.subarray(row * srcRowBytes, row * srcRowBytes + srcRowBytes),
      row * dstRowBytes
    );
    // Fill extra columns with opaque black
    for (let col = srcW; col < dstW; col++) {
      const idx = row * dstRowBytes + col * 4;
      dst[idx + 3] = 255; // alpha = opaque, RGB already 0
    }
  }

  // Fill extra rows with opaque black
  for (let row = srcH; row < dstH; row++) {
    for (let col = 0; col < dstW; col++) {
      const idx = row * dstRowBytes + col * 4;
      dst[idx + 3] = 255;
    }
  }

  return dst;
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
  // WebCodecs cleanup
  if (encoder) {
    try {
      encoder.close();
    } catch {
      // Encoder may already be closed or in error state
    }
    encoder = null;
  }
  output = null;
  videoSource = null;

  // WASM cleanup
  if (wasmEncoder) {
    try {
      wasmEncoder.delete();
    } catch {
      // Ignore errors during cleanup
    }
    wasmEncoder = null;
  }

  frameDurationMicros = 0;
  encoderWidth = 0;
  encoderHeight = 0;
  sourceWidth = 0;
  sourceHeight = 0;
  encoderErrored = false;
  encodedFrames = 0;
}

// ---------------------------------------------------------------------------
// Message handlers -- WebCodecs path
// ---------------------------------------------------------------------------

async function handleConfigWebCodecs(config: ExportConfig): Promise<void> {
  const useAv1 = config.codec === "av1";

  // Create mediabunny MP4 output with in-memory fast-start
  videoSource = new EncodedVideoPacketSource(useAv1 ? "av1" : "avc");
  output = new Output({
    format: new Mp4OutputFormat({ fastStart: config.fragmented ? "fragmented" : "in-memory" }),
    target: new BufferTarget(),
  });
  output.addVideoTrack(videoSource, { frameRate: config.fps });
  await output.start();

  const localVideoSource = videoSource;

  // Create WebCodecs VideoEncoder.
  //
  // When the encoder hits an internal error (e.g. hardware encoder refusing
  // a frame, queue overflow), the browser transitions it to the "closed"
  // state and fires the error callback. We track that in encoderErrored so
  // subsequent frame messages bail out cleanly instead of trying
  // encoder.encode() on a dead codec - which would throw "Cannot call
  // 'encode' on a closed codec" for every remaining frame, drowning the
  // original error in noise.
  //
  // The error message we post includes the encoder state and the last
  // known queue size at the time of failure. Hardware encoders typically
  // error when the internal queue overflows - seeing "queueSize=N" in the
  // error tells us exactly which failure mode we hit.
  encoder = new VideoEncoder({
    output: async (chunk, meta) => {
      const packet = EncodedPacket.fromEncodedChunk(chunk);
      await localVideoSource.add(packet, meta);
      // Progress is reported HERE, not on frame receipt — see `encodedFrames`.
      post({ type: "progress", frameIndex: encodedFrames++ });
    },
    error: (e) => {
      encoderErrored = true;
      const state = encoder?.state ?? "null";
      const queueSize = encoder?.encodeQueueSize ?? -1;
      post({
        type: "error",
        error: `VideoEncoder error: ${e.message} (state=${state}, queueSize=${queueSize})`,
      });
    },
  });

  // Omit `hardwareAcceleration` entirely - this is the spec default
  // (`"no-preference"`) and it's what production encoders should use.
  //
  // Why NOT "prefer-hardware":
  // The older version of this config forced "prefer-hardware" to save
  // a few ms/frame. In practice that choice was invisible compared to
  // its downside: hardware H.264 encoders have tight internal queues and
  // enter the closed state the moment a complex scene (collision lab,
  // full audience, multi-performer effects) overwhelms them. Once closed,
  // there's no recovery - the entire export fails near 100%.
  //
  // With "no-preference" the browser picks hardware when it's safe and
  // transparently uses software when it isn't, which is exactly the
  // correctness/speed tradeoff we actually want.
  const baseConfig: VideoEncoderConfig = {
    codec: useAv1
      ? selectCodecAv1(encoderWidth, encoderHeight, "10")
      : selectCodec(encoderWidth, encoderHeight),
    width: encoderWidth,
    height: encoderHeight,
    bitrate: config.bitrate,
    framerate: config.fps,
    // Prioritize quality over realtime latency: lets the encoder use
    // lookahead + frame reordering (B-frames under High profile) instead of
    // the low-latency single-pass mode tuned for live streaming.
    latencyMode: "quality",
    // Constant bitrate floors the per-frame allocation. Under the default VBR,
    // the encoder spends few bits on the "simple" near-black frames, so the
    // dark background gradient quantizes coarsely and reads as speckle/noise.
    // CBR keeps the dark regions clean — the visible noise lever alongside
    // 10-bit depth.
    bitrateMode: "constant",
  };

  // Probe support and degrade gracefully. AV1 10-bit + CBR is the max-fidelity
  // target, but not every platform AV1 encoder offers 10-bit; fall back to
  // 8-bit (still 4:4:4 CBR) rather than failing the export. If even that probe
  // is unsupported, fall through to the base config and let configure() throw
  // its own descriptive error.
  let encoderConfig = baseConfig;
  if (useAv1) {
    const tenBitOk = await VideoEncoder.isConfigSupported(baseConfig)
      .then((r) => r.supported === true)
      .catch(() => false);
    if (!tenBitOk) {
      encoderConfig = {
        ...baseConfig,
        codec: selectCodecAv1(encoderWidth, encoderHeight, "08"),
      };
    }
  }

  await encoder.configure(encoderConfig);
}

function handleFrameWebCodecs(msg: FrameMessageLegacy): void {
  if (!encoder || encoderErrored || encoder.state !== "configured") return;

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
  // Use the buffer overload with VideoFrameBufferInit for correct typing.
  const frame = new VideoFrame(frameData.data.buffer, {
    format: "RGBA",
    codedWidth: frameData.width,
    codedHeight: frameData.height,
    timestamp: msg.timestampMicros,
    duration: frameDurationMicros,
  });

  encoder.encode(frame, { keyFrame: msg.isKeyframe });

  // Close immediately to free GPU/memory resources
  frame.close();
}

function handleFrameCapturedWebCodecs(msg: FrameMessageCaptured): void {
  // Bail if the encoder is gone or has already errored. Without this guard
  // every remaining frame in flight would try to encode on a dead codec
  // and throw "Cannot call 'encode' on a closed codec", spamming the main
  // thread and drowning the original error. The main thread relies on the
  // first error message it received to surface the real failure.
  //
  // We must still close any VideoFrame we own in the bail path, otherwise
  // the frame leaks through to GC and Chrome logs
  // "VideoFrame was garbage collected without being closed".
  if (!encoder || encoderErrored || encoder.state !== "configured") {
    if (msg.frame.kind === "video-frame") {
      msg.frame.frame.close();
    }
    return;
  }

  let videoFrame: VideoFrame | null = null;
  try {
    if (msg.frame.kind === "video-frame") {
      // Fast path - the main thread handed us a ready-to-encode VideoFrame
      // constructed from the source canvas.
      videoFrame = msg.frame.frame;
    } else {
      // Fallback path - wrap the ImageData in a VideoFrame. This is only
      // reached when the main thread has no VideoFrame constructor at all,
      // which also means this worker should have taken the WASM branch;
      // we handle it here for safety but it should never fire in practice.
      videoFrame = new VideoFrame(msg.frame.data.data.buffer, {
        format: "RGBA",
        codedWidth: msg.frame.width,
        codedHeight: msg.frame.height,
        timestamp: msg.frame.timestampMicros,
        duration: frameDurationMicros,
      });
    }

    encoder.encode(videoFrame, { keyFrame: msg.isKeyframe });
  } catch (err) {
    // Defensive: if encode() throws synchronously (e.g. the codec entered
    // the closed state between our state check above and this call), flip
    // encoderErrored so subsequent frames bail cleanly. Don't rethrow -
    // the error callback will surface the real cause.
    encoderErrored = true;
    post({
      type: "error",
      error: `VideoEncoder error: ${err instanceof Error ? err.message : String(err)}`,
    });
  } finally {
    // Invariant: every VideoFrame the worker owns must be closed exactly
    // once. encoder.encode() does NOT take ownership - the caller closes.
    videoFrame?.close();
  }
}

function handleFrameCapturedWasm(msg: FrameMessageCaptured): void {
  if (!wasmEncoder) return;

  // WASM path needs raw RGBA bytes. A video-frame kind here means the
  // main thread incorrectly sent a GPU handle to a worker that can't
  // consume one - treat it as an error so the mismatch surfaces in tests.
  if (msg.frame.kind !== "image-data") {
    post({
      type: "error",
      error: "WASM encoder requires image-data frames; got video-frame",
    });
    return;
  }

  const paddedData = padRgbaData(
    msg.frame.data.data,
    msg.frame.width,
    msg.frame.height,
    encoderWidth,
    encoderHeight
  );

  wasmEncoder.addFrameRgba(paddedData);
}

async function handleFinishWebCodecs(): Promise<void> {
  if (!encoder || !output) {
    post({ type: "error", error: "Cannot finish: encoder not active" });
    return;
  }

  // If the encoder died mid-export, don't try to flush a dead codec.
  // Post an error so the main thread's finish() promise rejects and the
  // UI can surface the failure - without this, the promise hangs forever
  // and the export UI freezes at 100% showing the Cancel button.
  //
  // The encoder's own error callback may have already fired and posted
  // the root-cause message, but we can't count on that: the callback is
  // asynchronous and may not have run by the time we get here. Posting
  // a dedicated finish-time error is the only thing that guarantees the
  // main thread's finish-side promise resolves.
  if (encoderErrored || encoder.state !== "configured") {
    cleanup();
    post({
      type: "error",
      error:
        "Encoder stopped accepting frames before export could finish " +
        "(the hardware encoder may have rejected the frame rate or " +
        "resolution - try a lower fps/resolution combination).",
    });
    return;
  }

  // Flush all remaining frames through the encoder pipeline
  await encoder.flush();

  // Finalize the MP4 container (writes moov atom)
  videoSource?.close();
  await output.finalize();

  // Extract the completed buffer
  const buffer = (output.target as BufferTarget).buffer!;

  // Clean up encoder/muxer state before posting
  cleanup();

  // Transfer (zero-copy) the buffer back to the main thread
  post({ type: "complete", buffer });
}

// ---------------------------------------------------------------------------
// Message handlers -- WASM fallback path
// ---------------------------------------------------------------------------

async function handleConfigWasm(config: ExportConfig): Promise<void> {
  // Dynamically import h264-mp4-encoder (WASM module)
  const h264Mp4Encoder = await import("h264-mp4-encoder");
  const createEncoder =
    h264Mp4Encoder.createH264MP4Encoder ??
    (
      h264Mp4Encoder.default as {
        createH264MP4Encoder: () => Promise<H264MP4Encoder>;
      }
    )?.createH264MP4Encoder;

  if (!createEncoder) {
    throw new Error(
      "Failed to load h264-mp4-encoder: createH264MP4Encoder not found"
    );
  }

  wasmEncoder = await createEncoder();

  wasmEncoder.width = encoderWidth;
  wasmEncoder.height = encoderHeight;
  wasmEncoder.frameRate = config.fps;
  wasmEncoder.kbps = Math.round(config.bitrate / 1000);
  wasmEncoder.groupOfPictures = 30;
  // Lower QP = higher quality. 20 left visible banding on the trail gradients;
  // 16 tightens quantization for smoother glow (fallback path only — Chrome
  // takes the WebCodecs High-profile branch above).
  wasmEncoder.quantizationParameter = 16;

  wasmEncoder.initialize();
}

function handleFrameWasm(msg: FrameMessageLegacy): void {
  if (!wasmEncoder) return;

  // Pad to even dimensions if needed, then pass RGBA data to the WASM encoder
  const paddedData = padRgbaData(
    msg.imageData.data,
    msg.imageData.width,
    msg.imageData.height,
    encoderWidth,
    encoderHeight
  );

  wasmEncoder.addFrameRgba(paddedData);
}

async function handleFinishWasm(): Promise<void> {
  if (!wasmEncoder) {
    post({ type: "error", error: "Cannot finish: WASM encoder not active" });
    return;
  }

  // Finalize encoding -- produces the complete MP4
  wasmEncoder.finalize();

  // Read the output from the WASM virtual filesystem
  const rawBuffer = wasmEncoder.FS.readFile(wasmEncoder.outputFilename);

  // Create a proper ArrayBuffer copy (rawBuffer is backed by WASM memory
  // which becomes invalid after delete)
  const buffer = new Uint8Array(rawBuffer).buffer;

  // Clean up WASM state before posting
  cleanup();

  // Transfer (zero-copy) the buffer back to the main thread
  post({ type: "complete", buffer });
}

// ---------------------------------------------------------------------------
// Unified message handlers (dispatch to WebCodecs or WASM)
// ---------------------------------------------------------------------------

async function handleConfig(config: ExportConfig): Promise<void> {
  cancelled = false;

  // Clean up any leftover state from a previous (possibly cancelled) export
  cleanup();

  encoderWidth = ensureEven(config.width);
  encoderHeight = ensureEven(config.height);
  sourceWidth = config.width;
  sourceHeight = config.height;
  frameDurationMicros = Math.round(1_000_000 / config.fps);

  if (hasWebCodecs) {
    await handleConfigWebCodecs(config);
  } else {
    await handleConfigWasm(config);
  }

  post({ type: "ready" });
}

function handleFrame(msg: FrameMessage): void {
  if (cancelled) return;

  // Only the WASM encoder reports on receipt, because it encodes synchronously
  // inside addFrameRgba — receipt and completion are the same moment there. The
  // WebCodecs path reports from the encoder's own output callback instead.
  if (msg.type === "frame-captured") {
    if (hasWebCodecs) {
      handleFrameCapturedWebCodecs(msg);
    } else {
      handleFrameCapturedWasm(msg);
      post({ type: "progress", frameIndex: msg.frameIndex });
    }
    return;
  }

  // Legacy imageData path - kept alive until both pipelines migrate.
  if (hasWebCodecs) {
    handleFrameWebCodecs(msg);
  } else {
    handleFrameWasm(msg);
    post({ type: "progress", frameIndex: msg.frameIndex });
  }
}

async function handleFinish(): Promise<void> {
  if (cancelled) {
    post({ type: "error", error: "Cannot finish: export was cancelled" });
    return;
  }

  try {
    if (hasWebCodecs) {
      await handleFinishWebCodecs();
    } else {
      await handleFinishWasm();
    }
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
      case "frame-captured":
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
