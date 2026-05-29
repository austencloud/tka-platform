import type { FrameGraph } from "./frame-graph";

export type BackendKind = "webgpu" | "webgl2" | "canvas2d-legacy";

export interface BackendStats {
  /** Wall time of the most recent executeFrame call, in ms. */
  lastFrameMs: number;
  /** Longest single-pass time within the most recent frame, in ms. */
  longestPassMs: number;
  /** FBOs currently held by the backend (includes ping-pong pairs). */
  fboCount: number;
}

/**
 * Render authority. One backend instance per display canvas.
 *
 * All persistent GPU state (shader programs, FBOs, per-tip ping-pong
 * state) is owned by the backend and keyed off identities surfaced in
 * the frame graph. Callers build a FrameGraph each frame; the backend
 * figures out what to allocate, reuse, or retire.
 */
export interface RenderBackend {
  readonly kind: BackendKind;

  /** Initialize against a display target. Safe to call exactly once. */
  initialize(canvas: HTMLCanvasElement): Promise<void>;

  /** Execute one frame. `time` is monotonic milliseconds (e.g. performance.now()). */
  executeFrame(graph: FrameGraph, time: number): void;

  /** Resize all managed FBOs + the display target. */
  resize(width: number, height: number): void;

  /** Release all GPU resources. */
  dispose(): void;

  /** Diagnostic snapshot for FPS overlay / perf panels. */
  getStats(): BackendStats;
}
