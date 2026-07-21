/**
 * Trail pass payload.
 *
 * Each tip carries its CURRENT leading-edge path (oldest→newest).
 * Backends rebuild the tapered polygon mesh from the path each frame
 * and draw it onto a per-tip ping-pong FBO that accumulates the trail
 * across frames via the decay shader.
 *
 * This mirrors the Canvas2D pipeline in `TrailOverlayCanvas` +
 * `Canvas2DTrailRenderer`: the head polygon is redrawn every frame;
 * older pixels persist in the accumulator and fade naturally.
 */

export type TrailBlendMode = "alpha" | "additive" | "screen";

export interface TrailTipState {
  /** Stable identity across frames. Backend uses this to key ping-pong FBOs. */
  tipId: string;
  /**
   * Current leading-edge points in NDC, oldest first.
   *
   * Coordinates: (-1,-1) bottom-left, (+1,+1) top-right, y up. Callers
   * translate from app-space. Expect ~5-20 points; backend smooths. An empty
   * path is a decay-only pass: the backend advances and blits the existing
   * accumulator for this tipId without stamping new geometry.
   */
  path: Array<[number, number]>;
  /** RGBA, each channel in 0..1. Alpha is the max opacity at the head. */
  color: [number, number, number, number];
  /** Head thickness in NDC units (1.0 ≈ 50% of viewport). */
  thickness: number;
  /** Tail thickness as fraction of head. Matches Canvas2D (0.3). */
  taperTailRatio: number;
  /** Halo width in NDC; 0 disables glow. */
  glow: number;
  /** Per-frame FBO fade rate. Factor = exp(-decayPerSecond * dt). */
  decayPerSecond: number;
  /** Head→tail fade exponent. Matches Canvas2D FADE_EXPONENT (2.5). */
  fadeExponent: number;
  /** Compositing mode when blitting this tip's FBO onto the scene target. */
  blendMode: TrailBlendMode;
  /**
   * Display-only alpha multiplier applied when the accumulator FBO is
   * blitted to screen. Defaults to 1 (full visibility). Drives smooth
   * per-tip fade in/out without disturbing the accumulator's contents.
   */
  blitAlpha?: number;
}

export interface TrailPassPayload {
  tips: TrailTipState[];
}
