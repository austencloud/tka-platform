import type { Motion2DParams } from "../translators/canvas2d-types";

/**
 * Per-tip input for the motion overlay. `blueColor` / `redColor` are
 * the resolved trail colors; the renderer reads them when
 * `params.colorMode === "prop-matched"`.
 */
export interface MotionTipInput {
  bluePosA: { x: number; y: number } | null;
  bluePosB: { x: number; y: number } | null;
  redPosA: { x: number; y: number } | null;
  redPosB: { x: number; y: number } | null;
  /** Per-prop trail colors for prop-matched colorMode. Hex strings. */
  blueColor: string;
  /** Per-prop trail colors for prop-matched colorMode. Hex strings. */
  redColor: string;
}

type TipKey = "bluePosA" | "bluePosB" | "redPosA" | "redPosB";

interface TipState {
  /** Last-seen position, used for velocity computation across frames. */
  lastPos: { x: number; y: number };
  /** Recent position ring buffer for ghost-stamp blur trail. */
  history: { x: number; y: number }[];
}

/**
 * Velocity-gated motion overlay renderer for the Canvas2D backend.
 *
 * Per-tip state machine — each frame computes velocity from last position,
 * skips drawing below `params.threshold * 600` px/s, then emits ghost stamps
 * (alpha-faded circles at history slots) and anime-style speed lines opposite
 * to the velocity vector. Skeleton implementation; full draw logic lands in
 * Phase 1d Task 4.
 */
export class Motion2DRenderer {
  private tipState: Partial<Record<TipKey, TipState>> = {};

  render(
    _ctx: CanvasRenderingContext2D,
    _params: Motion2DParams,
    _tips: MotionTipInput,
    _dt: number,
  ): void {
    // Skeleton — full implementation lands in Task 4.
  }

  dispose(): void {
    this.tipState = {};
  }
}
