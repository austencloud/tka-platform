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
const TIP_KEYS: TipKey[] = ["bluePosA", "bluePosB", "redPosA", "redPosB"];

interface TipState {
  /** Last-seen position, used for velocity computation across frames. */
  lastPos: { x: number; y: number };
  /** Recent position ring buffer for ghost-stamp blur trail. */
  history: { x: number; y: number }[];
}

/**
 * Threshold scale: `threshold` slider is normalized 0-1; multiply by this
 * to get a px/s velocity floor. 600 px/s is a calibrated reference for "fast
 * prop swing" — at threshold=1 only very fast motion fires the effect.
 */
const VELOCITY_REFERENCE_PX_PER_S = 600;

/**
 * Velocity-gated motion overlay renderer for the Canvas2D backend.
 *
 * Per-tip state machine — each frame computes velocity from last position,
 * skips drawing below `params.threshold * 600` px/s, then emits ghost stamps
 * (alpha-faded circles at recent history slots) and anime-style speed lines
 * pointing opposite to the velocity vector. Color picked per-stroke by
 * `params.colorMode` (solid / rainbow / velocity / prop-matched). Additive
 * blending so overlapping streaks brighten.
 */
export class Motion2DRenderer {
  private tipState: Partial<Record<TipKey, TipState>> = {};

  render(
    ctx: CanvasRenderingContext2D,
    params: Motion2DParams,
    tips: MotionTipInput,
    dt: number,
  ): void {
    const prevComposite = ctx.globalCompositeOperation;
    const prevAlpha = ctx.globalAlpha;
    const prevFill = ctx.fillStyle;
    const prevStroke = ctx.strokeStyle;
    const prevLineWidth = ctx.lineWidth;
    const prevLineCap = ctx.lineCap;

    try {
      ctx.globalCompositeOperation = (params as { blendMode?: GlobalCompositeOperation }).blendMode ?? "lighter";
      ctx.lineCap = "round";

      const safeDt = Math.max(dt, 1e-4);
      const velocityFloor = params.threshold * VELOCITY_REFERENCE_PX_PER_S;
      // Ring buffer length scales with blur. Floor of 2 guarantees at least
      // some history so blur=0 path simply skips drawing instead of crashing.
      const historyLimit = Math.max(2, Math.floor(8 + params.blur * 12));

      for (const key of TIP_KEYS) {
        const tip = tips[key];
        if (!tip) {
          delete this.tipState[key];
          continue;
        }

        let state = this.tipState[key];
        if (!state) {
          state = { lastPos: { x: tip.x, y: tip.y }, history: [] };
          this.tipState[key] = state;
          // First frame seeds last position only — no velocity yet.
          continue;
        }

        const dx = tip.x - state.lastPos.x;
        const dy = tip.y - state.lastPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const velocity = dist / safeDt; // px/s

        // Always update history + lastPos so the buffer stays current; only
        // skip the DRAW step below the threshold so the effect goes silent on
        // still props but resumes immediately when motion picks up.
        state.history.push({ x: tip.x, y: tip.y });
        if (state.history.length > historyLimit) {
          state.history.splice(0, state.history.length - historyLimit);
        }
        state.lastPos = { x: tip.x, y: tip.y };

        if (velocity < velocityFloor) continue;

        const tipColor = this.tipColorFor(key, tips);

        // Ghost stamps — alpha decays from blur*0.6 → 0 across the history.
        if (params.blur > 0 && state.history.length > 1) {
          const baseRadius = 4 + params.blur * 6;
          for (let i = 0; i < state.history.length; i++) {
            const h = state.history[i]!;
            const t = i / Math.max(1, state.history.length - 1);
            const alpha = params.blur * 0.6 * t;
            if (alpha <= 0.01) continue;
            ctx.fillStyle = this.pickColor(params, velocity, tipColor);
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(h.x, h.y, baseRadius * (0.5 + t * 0.5), 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Speed lines — emit `params.count` short streaks opposite to velocity.
        if (params.speedLines > 0 && velocity > 0) {
          const ux = -dx / dist; // unit vector backwards
          const uy = -dy / dist;
          // Perpendicular for side-line offset.
          const px = -uy;
          const py = ux;
          const baseLength = params.length * 24 + Math.min(velocity, 1200) * params.length * 0.05;
          const lineWidth = 1.5 + params.speedLines * 1.5;
          ctx.lineWidth = lineWidth;

          for (let i = 0; i < params.count; i++) {
            // Center line at i=0; alternate sides for i>=1 with growing offset.
            const sideIndex = i === 0 ? 0 : (i % 2 === 1 ? 1 : -1) * Math.ceil(i / 2);
            const offset = sideIndex * 4;
            const startX = tip.x + px * offset;
            const startY = tip.y + py * offset;
            // Slight per-line length jitter so anime streaks read as a fan, not parallel rails.
            const lengthJitter = baseLength * (0.7 + Math.random() * 0.6);
            const endX = startX + ux * lengthJitter;
            const endY = startY + uy * lengthJitter;

            ctx.strokeStyle = this.pickColor(params, velocity, tipColor);
            ctx.globalAlpha = Math.min(1, params.speedLines);
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
          }
        }
      }
    } finally {
      ctx.globalCompositeOperation = prevComposite;
      ctx.globalAlpha = prevAlpha;
      ctx.fillStyle = prevFill;
      ctx.strokeStyle = prevStroke;
      ctx.lineWidth = prevLineWidth;
      ctx.lineCap = prevLineCap;
    }
  }

  private pickColor(params: Motion2DParams, velocity: number, propMatched: string): string {
    switch (params.colorMode) {
      case "rainbow":
        return `hsl(${(Date.now() * 0.1) % 360}, 80%, 60%)`;
      case "velocity": {
        // Cool (blue, hue 220) at rest, hot (red, hue 0) at high speed.
        const hue = 220 - Math.min(velocity, 1500) / 1500 * 220;
        return `hsl(${hue}, 90%, 60%)`;
      }
      case "prop-matched":
        return propMatched;
      case "solid":
      default:
        return params.color;
    }
  }

  private tipColorFor(key: TipKey, tips: MotionTipInput): string {
    return key === "bluePosA" || key === "bluePosB" ? tips.blueColor : tips.redColor;
  }

  dispose(): void {
    this.tipState = {};
  }
}
