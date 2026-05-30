/// <reference lib="webworker" />

/**
 * Mandala Export Web Worker — encode only.
 *
 * Chromium cannot rasterize SVG off the main thread (`createImageBitmap` on an
 * SVG blob throws "source image could not be decoded" in a Worker). So the main
 * thread rasterizes each frame's mandala SVG to an ImageBitmap (preserving exact
 * visual parity with the on-screen SVG render) and transfers it here; this worker
 * composites the rotation + background onto an OffscreenCanvas and runs the
 * heavy H.264 encode off the main thread.
 *
 * Two encode paths (mirrors video-export.worker.ts):
 *   1. WebCodecs (Chrome/Edge/Safari) — VideoEncoder + mediabunny mux.
 *   2. WASM fallback (Firefox) — h264-mp4-encoder.
 */

import { Output, Mp4OutputFormat, BufferTarget, EncodedVideoPacketSource, EncodedPacket } from "mediabunny";

const hasWebCodecs = typeof VideoEncoder !== "undefined";

// ── Messages ────────────────────────────────────────────────────────────────

interface ConfigMessage {
  type: "config";
  width: number;
  height: number;
  fps: number;
  bitrate: number;
  bgColor: string;
}
interface FrameMessage {
  type: "frame";
  bitmap: ImageBitmap;
  rotDeg: number;
  index: number;
  totalFrames: number;
}
interface FinishMessage { type: "finish"; }
interface CancelMessage { type: "cancel"; }
export type MandalaExportIn = ConfigMessage | FrameMessage | FinishMessage | CancelMessage;

export type MandalaExportOut =
  | { type: "ready" }
  | { type: "progress"; frameIndex: number; totalFrames: number }
  | { type: "complete"; buffer: ArrayBuffer }
  | { type: "error"; error: string };

const scope = self as unknown as DedicatedWorkerGlobalScope;

function post(msg: MandalaExportOut): void {
  if (msg.type === "complete") scope.postMessage(msg, [msg.buffer]);
  else scope.postMessage(msg);
}

// ── h264-mp4-encoder (WASM) type ─────────────────────────────────────────────

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
  FS: { readFile: (name: string) => Uint8Array };
  outputFilename: string;
  delete: () => void;
};

function selectCodec(width: number, height: number): string {
  const px = width * height;
  if (px <= 921_600) return "avc1.42001f";
  if (px <= 2_073_600) return "avc1.420028";
  if (px <= 8_912_896) return "avc1.420033";
  return "avc1.42003c";
}

// ── Worker state ──────────────────────────────────────────────────────────────

let cancelled = false;
let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let size = 0;
let bg = "#000000";
let frameDurationUs = 0;

let videoEncoder: VideoEncoder | null = null;
let output: Output | null = null;
let videoSource: EncodedVideoPacketSource | null = null;
let wasm: H264MP4Encoder | null = null;
let encoderErrored = false;

function cleanup(): void {
  try { videoEncoder?.close(); } catch { /* already closed */ }
  try { wasm?.delete(); } catch { /* ignore */ }
  videoEncoder = null;
  output = null;
  videoSource = null;
  wasm = null;
  canvas = null;
  ctx = null;
  encoderErrored = false;
}

async function handleConfig(msg: ConfigMessage): Promise<void> {
  cancelled = false;
  cleanup();

  size = msg.width;
  bg = msg.bgColor;
  frameDurationUs = Math.round(1_000_000 / msg.fps);
  canvas = new OffscreenCanvas(size, size);
  ctx = canvas.getContext("2d", { alpha: false })!;

  if (hasWebCodecs) {
    videoSource = new EncodedVideoPacketSource("avc");
    output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
    output.addVideoTrack(videoSource, { frameRate: msg.fps });
    await output.start();
    const localSource = videoSource;
    videoEncoder = new VideoEncoder({
      output: async (chunk, meta) => {
        await localSource.add(EncodedPacket.fromEncodedChunk(chunk), meta);
      },
      error: (e) => {
        encoderErrored = true;
        post({ type: "error", error: `VideoEncoder error: ${e.message}` });
      },
    });
    await videoEncoder.configure({ codec: selectCodec(size, size), width: size, height: size, bitrate: msg.bitrate, framerate: msg.fps });
  } else {
    const mod = await import("h264-mp4-encoder");
    const create = mod.createH264MP4Encoder ??
      (mod.default as { createH264MP4Encoder: () => Promise<H264MP4Encoder> })?.createH264MP4Encoder;
    if (!create) throw new Error("h264-mp4-encoder unavailable");
    wasm = await create();
    wasm.width = size;
    wasm.height = size;
    wasm.frameRate = msg.fps;
    wasm.kbps = Math.round(msg.bitrate / 1000);
    wasm.groupOfPictures = 30;
    wasm.quantizationParameter = 18;
    wasm.initialize();
  }

  post({ type: "ready" });
}

function handleFrame(msg: FrameMessage): void {
  if (cancelled || !ctx || !canvas) {
    msg.bitmap.close();
    return;
  }

  // Composite: opaque bg + rotation about center + the rasterized mandala.
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.rotate((msg.rotDeg * Math.PI) / 180);
  ctx.translate(-size / 2, -size / 2);
  ctx.drawImage(msg.bitmap, 0, 0, size, size);
  ctx.restore();
  msg.bitmap.close();

  if (hasWebCodecs) {
    if (!videoEncoder || encoderErrored || videoEncoder.state !== "configured") {
      post({ type: "error", error: "Encoder stopped accepting frames" });
      return;
    }
    const frame = new VideoFrame(canvas, { timestamp: msg.index * frameDurationUs, duration: frameDurationUs });
    videoEncoder.encode(frame, { keyFrame: msg.index % 30 === 0 });
    frame.close();
  } else {
    const data = ctx.getImageData(0, 0, size, size);
    wasm!.addFrameRgba(data.data);
  }

  post({ type: "progress", frameIndex: msg.index + 1, totalFrames: msg.totalFrames });
}

async function handleFinish(): Promise<void> {
  try {
    let buffer: ArrayBuffer;
    if (hasWebCodecs) {
      if (encoderErrored || !videoEncoder || videoEncoder.state !== "configured") {
        throw new Error("Encoder stopped before finish");
      }
      await videoEncoder.flush();
      videoSource!.close();
      await output!.finalize();
      buffer = (output!.target as BufferTarget).buffer!;
    } else {
      wasm!.finalize();
      const raw = wasm!.FS.readFile(wasm!.outputFilename);
      buffer = new Uint8Array(raw).buffer;
    }
    cleanup();
    post({ type: "complete", buffer });
  } catch (err) {
    cleanup();
    post({ type: "error", error: err instanceof Error ? err.message : String(err) });
  }
}

scope.onmessage = async (event: MessageEvent<MandalaExportIn>) => {
  const msg = event.data;
  try {
    switch (msg.type) {
      case "config":
        await handleConfig(msg);
        break;
      case "frame":
        handleFrame(msg);
        break;
      case "finish":
        await handleFinish();
        break;
      case "cancel":
        cancelled = true;
        cleanup();
        break;
    }
  } catch (err) {
    cleanup();
    post({ type: "error", error: err instanceof Error ? err.message : String(err) });
  }
};
