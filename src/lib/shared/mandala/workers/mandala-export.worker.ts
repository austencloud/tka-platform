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

// Keep the WebCodecs encoder's input queue deep enough to stay fed (a shallow
// queue starves the HW pipeline — depth 6 cut 4K throughput by ~2.4×), but
// bounded by a ~150MB in-flight frame budget so 4K can't OOM a phone. Computed
// per-resolution in runExport via queueDepthFor().
function queueDepthFor(size: number): number {
  const frameBytes = size * size * 1.5; // YUV420 bytes per frame
  return Math.max(8, Math.min(24, Math.round(150_000_000 / frameBytes)));
}

// ── Messages ────────────────────────────────────────────────────────────────

interface StartMessage {
  type: "start";
  spec: MandalaFrameSpec;
  bitrate: number;
}
interface CancelMessage { type: "cancel"; }
export type MandalaExportIn = StartMessage | CancelMessage;

/** Live diagnostic of where export wall-time goes. `phase` is "config" (emitted
 *  once after the encoder is configured), "running" (periodic), or "done". */
export interface MandalaExportDiag {
  type: "diag";
  phase: "config" | "running" | "done";
  codec: string;
  /** Whether the runtime reported the hardware-accelerated config as supported. */
  hwSupported: boolean;
  encoder: "webcodecs" | "wasm";
  resolution: number;
  fps: number;
  totalFrames: number;
  encodedFrames: number;
  /** Cumulative ms in geometry+canvas render. */
  renderMs: number;
  /** Cumulative ms blocked on encoder backpressure (= encode-bound time). */
  encodeWaitMs: number;
  /** Cumulative ms in the mux (mediabunny add). */
  muxMs: number;
  /** Observed encode throughput so far (frames / wall-second since first frame). */
  encodeFps: number;
  /** Cumulative ms creating VideoFrames from the canvas (GPU upload / copy). */
  vfMs: number;
}

export type MandalaExportOut =
  | { type: "progress"; frameIndex: number; totalFrames: number }
  | { type: "finalizing" }
  | { type: "complete"; buffer: ArrayBuffer }
  | { type: "error"; error: string }
  | MandalaExportDiag;

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
  // High profile (0x64). Windows Media Foundation HW encoders typically only
  // accelerate Main/High, not Baseline (0x42) — matches the proven 2D exporter.
  const px = width * height;
  if (px <= 921_600) return "avc1.64001f";
  if (px <= 2_073_600) return "avc1.640028";
  if (px <= 8_912_896) return "avc1.640033";
  return "avc1.64003c";
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
  const maxQueue = queueDepthFor(size);

  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) { running = false; post({ type: "error", error: "OffscreenCanvas 2D context unavailable" }); return; }

  const calculator = new MandalaGeometryCalculator();
  // Geometry depends only on undulation phase → compute each of the
  // `framesPerCycle` phases once and reuse across reps. Mask scratch avoids two
  // full-res OffscreenCanvas allocations per frame.
  const geoCache: MandalaGeometryCache = new Map();
  const scratch = { a: new OffscreenCanvas(size, size), b: new OffscreenCanvas(size, size) };

  // ── Diagnostics ──
  let renderMs = 0, waitMs = 0, muxMs = 0, vfMs = 0;
  let codec = "";
  let hwSupported = false;
  let firstFrameMs = 0;
  const encoderKind: "webcodecs" | "wasm" = hasWebCodecs ? "webcodecs" : "wasm";
  const emitDiag = (phase: "config" | "running" | "done"): void => {
    const elapsedS = firstFrameMs ? (performance.now() - firstFrameMs) / 1000 : 0;
    post({
      type: "diag", phase, codec, hwSupported, encoder: encoderKind,
      resolution: size, fps: spec.fps, totalFrames, encodedFrames: encodedCount,
      renderMs: Math.round(renderMs), encodeWaitMs: Math.round(waitMs), muxMs: Math.round(muxMs),
      vfMs: Math.round(vfMs),
      encodeFps: elapsedS > 0 ? +(encodedCount / elapsedS).toFixed(1) : 0,
    });
  };

  try {
    if (hasWebCodecs) {
      videoSource = new EncodedVideoPacketSource("avc");
      output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
      output.addVideoTrack(videoSource, { frameRate: spec.fps });
      await output.start();
      const localSource = videoSource;
      videoEncoder = new VideoEncoder({
        output: async (chunk, meta) => {
          const m0 = performance.now();
          await localSource.add(EncodedPacket.fromEncodedChunk(chunk), meta);
          muxMs += performance.now() - m0;
          encodedCount++;
          post({ type: "progress", frameIndex: encodedCount, totalFrames });
          if (encodedCount % 30 === 0) emitDiag("running");
        },
        error: (e) => {
          encoderErrored = true;
          post({ type: "error", error: `VideoEncoder error: ${e.message}` });
        },
      });
      {
        // Request hardware H.264 (Media Foundation / VAAPI / VideoToolbox) with
        // realtime single-pass latency — the fastest encode path. Falls back to
        // the software default when the runtime can't hardware-accelerate the
        // config. High profile (selectCodec) is what HW encoders accelerate.
        const base = { codec: selectCodec(size, size), width: size, height: size, bitrate, framerate: spec.fps, latencyMode: "realtime" as const };
        const hw = { ...base, hardwareAcceleration: "prefer-hardware" as const };
        let support: VideoEncoderSupport | null = null;
        try { support = await VideoEncoder.isConfigSupported(hw); } catch { support = null; }
        codec = base.codec;
        hwSupported = support?.supported ?? false;
        await videoEncoder.configure(hwSupported ? hw : base);
      }
      emitDiag("config");
    } else {
      const mod = await import("h264-mp4-encoder");
      const create = mod.createH264MP4Encoder ??
        (mod.default as { createH264MP4Encoder: () => Promise<H264MP4Encoder> })?.createH264MP4Encoder;
      if (!create) throw new Error("h264-mp4-encoder unavailable");
      codec = "h264-wasm";
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

      if (i === 0) firstFrameMs = performance.now();
      const r0 = performance.now();
      renderMandalaFrameToCanvas(ctx, calculator, spec, math, i, geoCache, scratch);
      renderMs += performance.now() - r0;

      if (hasWebCodecs) {
        // Respect encoder backpressure so the queue (and final flush) stays shallow.
        const w0 = performance.now();
        while (videoEncoder && videoEncoder.encodeQueueSize >= maxQueue && !cancelled && !encoderErrored) {
          await nextTick();
        }
        waitMs += performance.now() - w0;
        if (cancelled) { cleanup(); return; }
        if (!videoEncoder || encoderErrored || videoEncoder.state !== "configured") {
          throw new Error("Encoder stopped accepting frames");
        }
        const v0 = performance.now();
        const frame = new VideoFrame(canvas, { timestamp: i * frameDurationUs, duration: frameDurationUs });
        vfMs += performance.now() - v0;
        videoEncoder.encode(frame, { keyFrame: i % 30 === 0 });
        frame.close();
      } else {
        const data = ctx.getImageData(0, 0, size, size);
        wasm!.addFrameRgba(data.data);
        encodedCount++;
        post({ type: "progress", frameIndex: encodedCount, totalFrames });
        if (encodedCount % 30 === 0) emitDiag("running");
        if (i % 8 === 0) await nextTick(); // keep the worker event loop responsive to cancel
      }
    }

    if (cancelled) { cleanup(); return; }

    emitDiag("done");
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
