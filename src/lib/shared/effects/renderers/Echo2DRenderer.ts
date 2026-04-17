import type { Echo2DParams } from "../translators/canvas2d-types";

/**
 * Per-tip input for the echo overlay. Each prop contributes a tip pair
 * (A + B ends of the staff) — a phantom captures the whole pair at once
 * so the rendered line correctly connects the two ends the user sees in
 * the live staff.
 *
 * `currentStep` drives beat-onset detection and phantom aging. It is the
 * authoritative step index from the animation engine (fractional, advances
 * during playback) — using it instead of wall-clock dt makes the
 * stroboscope land exactly on the beat grid regardless of frame jitter.
 *
 * `blueColor` / `redColor` are consumed when `params.colorMode === "prop-matched"`.
 */
export interface EchoTipInput {
  bluePosA: { x: number; y: number } | null;
  bluePosB: { x: number; y: number } | null;
  redPosA: { x: number; y: number } | null;
  redPosB: { x: number; y: number } | null;
  /** Current animation step index (fractional). Used for beat-onset detection + aging. */
  currentStep: number;
  /** Hex for blue prop — used when params.colorMode === "prop-matched". */
  blueColor: string;
  /** Hex for red prop — used when params.colorMode === "prop-matched". */
  redColor: string;
}

type Vec2 = { x: number; y: number };

interface Phantom {
  posA: Vec2;
  posB: Vec2;
  /** `currentStep` at the moment of capture. Age = (currentStep - capturedStep) / interval. */
  capturedStep: number;
}

/**
 * Beat-onset phantom renderer for the Canvas2D backend.
 *
 * On each frame, reads the current animation step; when a beat boundary
 * is crossed (`floor(currentStep / interval) > lastBeatIndex`), captures
 * a phantom of each active prop's tip pair. Phantoms age by the same
 * step index and are culled once their age (in intervals) reaches `decay`.
 *
 * Rendering uses additive blend so overlapping phantoms brighten where
 * the prop returned to a position — the viewer sees the beat lattice as
 * a constellation of fading ghosts.
 */
export class Echo2DRenderer {
  private phantomsBlue: Phantom[] = [];
  private phantomsRed: Phantom[] = [];
  private lastBeatIndex: number = -1;

  render(
    ctx: CanvasRenderingContext2D,
    params: Echo2DParams,
    tips: EchoTipInput,
  ): void {
    // Implementation lands in Task 4.
  }

  dispose(): void {
    this.phantomsBlue = [];
    this.phantomsRed = [];
    this.lastBeatIndex = -1;
  }
}
