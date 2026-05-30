/// <reference lib="webworker" />

/**
 * Mandala Export Web Worker — full render + encode, fully off the main thread.
 *
 * The geometry calculator is pure trig and the mandala renders via Path2D onto
 * an OffscreenCanvas, so the ENTIRE pipeline runs here: per-frame geometry,
 * gradient/glow render, rotation, and the H.264 encode. The main thread only
 * posts the spec once and listens for progress — it never rasterizes a frame,
 * so the on-screen mandala keeps undulating without jank.
 *
 * (The earlier design rasterized SVG on the main thread because Chromium can't
 * `createImageBitmap` an SVG in a Worker. Rendering via canvas Path2D instead
 * sidesteps SVG entirely and reaches the true off-thread goal.)
 *
 * Frames drain through the encoder with `encodeQueueSize` backpressure and
 * progress is reported from the encoder's real output callback (one chunk = one
 * encoded frame), so the bar tracks true throughput and the final `flush()`
 * stays cheap instead of stalling on a frozen "Encoding…" screen.
 *
 * Two encode paths (mirrors video-export.worker.ts):
 *   1. WebCodecs (Chrome/Edge/Safari) — VideoEncoder + mediabunny mux.
 *   2. WASM fallback (Firefox) — h264-mp4-encoder.
 */

import { Output, Mp4OutputFormat, BufferTarget, EncodedVideoPacketSource, EncodedPacket } from "mediabunny";
import { MandalaGeometryCalculator } from "../services/mandala-geometry-calculator";
import {
  deriveFrameMath,
  renderMandalaFrameToCanvas,
  type MandalaFrameSpec,
  type MandalaGeometryCache,
} from "../services/mandala-frame-renderer";

const hasWebCodecs = typeof VideoEncoder !== "undefined";

// Cap the WebCodecs encoder's internal queue so the final flush stays cheap and
// progress tracks real encode throughput.
const MAX_ENCODE_QUEUE = 6;

// ── Messages ────────────────────────────────────────────────────────────────

interface StartMessage {
  type: "start";
  spec: MandalaFrameSpec;
  bitrate: number;
}
interface CancelMessage { type: "cancel"; }
export type MandalaExportIn = StartMessage | CancelMessage;

export type MandalaExportOut =
  | { type: "progress"; frameIndex: number; totalFrames: number }
  | { type: "finalizing" }
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

const nextTick = () => new Promise<void>((r) => setTimeout(r, 0));

// ── Worker state ──────────────────────────────────────────────────────────────

let cancelled = false;
let running = false;

let videoEncoder: VideoEncoder | null = null;
let output: Output | null = null;
let videoSource: EncodedVideoPacketSource | null = null;
let wasm: H264MP4Encoder | null = null;
let encoderErrored = false;
let encodedCount = 0;

function cleanup(): void {
  try { videoEncoder?.close(); } catch { /* already closed */ }
  try { wasm?.delete(); } catch { /* ignore */ }
  videoEncoder = null;
  output = null;
  videoSource = null;
  wasm = null;
  encoderErrored = false;
  encodedCount = 0;
  running = false;
}

async function runExport(msg: StartMessage): Promise<void> {
  if (running) return;
  running = true;
  cancelled = false;
  encoderErrored = false;
  encodedCount = 0;

  const { spec, bitrate } = msg;
  const size = spec.resolution;
  const math = deriveFrameMath(spec);
  const totalFrames = math.totalFrames;
  const frameDurationUs = Math.round(1_000_000 / spec.fps);

  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) { running = false; post({ type: "error", error: "OffscreenCanvas 2D context unavailable" }); return; }

  const calculator = new MandalaGeometryCalculator();
  // Geometry depends only on undulation phase → compute each of the
  // `framesPerCycle` phases once and reuse across reps. Mask scratch avoids two
  // full-res OffscreenCanvas allocations per frame.
  const geoCache: MandalaGeometryCache = new Map();
  const scratch = { a: new OffscreenCanvas(size, size), b: new OffscreenCanvas(size, size) };

  try {
    if (hasWebCodecs) {
      videoSource = new EncodedVideoPacketSource("avc");
      output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
      output.addVideoTrack(videoSource, { frameRate: spec.fps });
      await output.start();
      const localSource = videoSource;
      videoEncoder = new VideoEncoder({
        output: async (chunk, meta) => {
          await localSource.add(EncodedPacket.fromEncodedChunk(chunk), meta);
          encodedCount++;
          post({ type: "progress", frameIndex: encodedCount, totalFrames });
        },
        error: (e) => {
          encoderErrored = true;
          post({ type: "error", error: `VideoEncoder error: ${e.message}` });
        },
      });
      await videoEncoder.configure({ codec: selectCodec(size, size), width: size, height: size, bitrate, framerate: spec.fps });
    } else {
      const mod = await import("h264-mp4-encoder");
      const create = mod.createH264MP4Encoder ??
        (mod.default as { createH264MP4Encoder: () => Promise<H264MP4Encoder> })?.createH264MP4Encoder;
      if (!create) throw new Error("h264-mp4-encoder unavailable");
      wasm = await create();
      wasm.width = size;
      wasm.height = size;
      wasm.frameRate = spec.fps;
      wasm.kbps = Math.round(bitrate / 1000);
      wasm.groupOfPictures = 30;
      wasm.quantizationParameter = 18;
      wasm.initialize();
    }

    for (let i = 0; i < totalFrames; i++) {
      if (cancelled) { cleanup(); return; }

      renderMandalaFrameToCanvas(ctx, calculator, spec, math, i, geoCache, scratch);

      if (hasWebCodecs) {
        // Respect encoder backpressure so the queue (and final flush) stays shallow.
        while (videoEncoder && videoEncoder.encodeQueueSize >= MAX_ENCODE_QUEUE && !cancelled && !encoderErrored) {
          await nextTick();
        }
        if (cancelled) { cleanup(); return; }
        if (!videoEncoder || encoderErrored || videoEncoder.state !== "configured") {
          throw new Error("Encoder stopped accepting frames");
        }
        const frame = new VideoFrame(canvas, { timestamp: i * frameDurationUs, duration: frameDurationUs });
        videoEncoder.encode(frame, { keyFrame: i % 30 === 0 });
        frame.close();
      } else {
        const data = ctx.getImageData(0, 0, size, size);
        wasm!.addFrameRgba(data.data);
        encodedCount++;
        post({ type: "progress", frameIndex: encodedCount, totalFrames });
        if (i % 8 === 0) await nextTick(); // keep the worker event loop responsive to cancel
      }
    }

    if (cancelled) { cleanup(); return; }

    post({ type: "finalizing" });

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
    if (!cancelled) post({ type: "complete", buffer });
  } catch (err) {
    cleanup();
    if (!cancelled) post({ type: "error", error: err instanceof Error ? err.message : String(err) });
  }
}

scope.onmessage = (event: MessageEvent<MandalaExportIn>) => {
  const msg = event.data;
  if (msg.type === "start") {
    void runExport(msg);
  } else if (msg.type === "cancel") {
    cancelled = true;
  }
};
