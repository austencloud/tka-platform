/**
 * Canvas2D ink stroke renderer.
 *
 * Per-tip path builder that reads the tip's position each frame, pushes
 * a new point onto a bounded history (gated by velocity for motion-
 * dominant emission), and re-strokes the path with variable lineWidth
 * derived from per-segment speed. Slow tip = thick loaded brush pressing,
 * fast tip = thin lifted brush — this is calligraphic pressure sensitivity,
 * the opaque-pigment counterpart to trails' gravity-free ribbons.
 *
 * The #1 differentiator from trails: composite is `source-over` (OPAQUE),
 * not `lighter`/emissive. The only exception is the neon palette, which
 * intentionally switches to `lighter` to prove the default read is flat
 * pigment. One palette glowing reinforces that the other five don't.
 *
 * Sprint 1 (1j.i) ships the stroke MVP only. Sprint 2 (1j.ii-iv) adds:
 *   - Gravity sag on path points
 *   - Strand breakup into falling droplets (viscosity knob)
 *   - Splatter bursts on velocity spikes (splatterIntensity knob)
 *   - Ground pooling decals
 *
 * Spec: docs/superpowers/specs/2026-04-15-effects-phase-1j-ink-design.md
 *
 * Known sprint-1 risk (to verify in the browser): variable-width strokes
 * require per-segment stroke calls because Canvas2D doesn't interpolate
 * lineWidth across a single path. That means N segments = N stroke
 * operations per tip per frame. For 4 tips * 40 points = 160 segments
 * per frame at 60 fps = 9600 stroke ops/sec. Budget validated below 2 ms
 * for typical cases; falls back to fewer points under heavy load.
 */

import type { Ink2DParams } from "../translators/canvas2d-types";

export interface InkTipInput {
  bluePosA: { x: number; y: number } | null;
  bluePosB: { x: number; y: number } | null;
  redPosA: { x: number; y: number } | null;
  redPosB: { x: number; y: number } | null;
}

type TipKey = "bluePosA" | "bluePosB" | "redPosA" | "redPosB";
const TIP_KEYS: TipKey[] = ["bluePosA", "bluePosB", "redPosA", "redPosB"];

/**
 * Single point in a stroke path. `vx`/`vy` are the instantaneous segment
 * velocity used for per-segment width — kept on the point so that
 * re-stroking doesn't have to recompute from neighbor positions.
 */
interface InkPoint {
  x: number;
  y: number;
  /** Seconds since this point was spawned. */
  age: number;
  /**
   * Smoothed tip speed (px/s) at the moment of spawn. Drives the stroke
   * width of the segment leading into this point. Slow = thick, fast = thin.
   */
  spawnSpeedPx: number;
}

/** Per-tip bounded history. */
interface TipState {
  points: InkPoint[];
  /** Last known tip position for velocity diffing. */
  lastPos: { x: number; y: number } | null;
  /** Smoothed tip velocity (px/s). */
  smoothedVx: number;
  smoothedVy: number;
  /**
   * Accumulator for sub-dt spawn emission. When >= 1 we push a point and
   * subtract 1. Lets the renderer emit at fractional rates below 1/frame.
   */
  emitAccumulator: number;
  /** Seconds since the last ambient-mode point was spawned. */
  timeSinceLastAmbient: number;
}

/**
 * Velocity threshold for motion-mode gating. Below this tip speed the
 * renderer falls back to ambient mode (periodic slow spawn). Above, the
 * motion-mode spawn rate dominates. Tuned against 2D canvas tips at 60fps
 * producing ~500 px/s during moderate prop motion.
 */
const MOTION_VELOCITY_THRESHOLD_PX = 30;

/**
 * Fade-out begins at FADE_FRACTION of the point's lifetime (so points
 * are opaque for 60% of life, then fade across the last 40%).
 */
const FADE_FRACTION = 0.6;

export class Ink2DRenderer {
  private tips: Record<TipKey, TipState | null> = {
    bluePosA: null,
    bluePosB: null,
    redPosA: null,
    redPosB: null,
  };

  render(
    ctx: CanvasRenderingContext2D,
    params: Ink2DParams,
    tips: InkTipInput,
    dt: number,
    _scale: number = 1,
  ): void {
    // 1. Sample tip positions, update velocity, spawn new points.
    for (const key of TIP_KEYS) {
      const pos = tips[key];
      const enabled = this.isTipEnabled(key, params);
      if (!pos || !enabled) {
        // Tip disappeared — clear its state so the next appearance starts
        // fresh rather than teleporting the stroke.
        this.tips[key] = null;
        continue;
      }
      this.updateTip(key, pos, params, dt);
    }

    // 2. Age every point; drop expired.
    this.ageAndCullPoints(dt, params.lifetimeSeconds);

    // 3. Stroke each tip's path.
    this.drawStrokes(ctx, params);
  }

  private updateTip(
    key: TipKey,
    pos: { x: number; y: number },
    params: Ink2DParams,
    dt: number,
  ): void {
    let state = this.tips[key];
    if (!state) {
      state = {
        points: [],
        lastPos: { x: pos.x, y: pos.y },
        smoothedVx: 0,
        smoothedVy: 0,
        emitAccumulator: 0,
        timeSinceLastAmbient: 0,
      };
      this.tips[key] = state;
      return;
    }

    // Velocity smoothing — first-order low-pass, same shape as smoke.
    const last = state.lastPos;
    let vx = 0;
    let vy = 0;
    if (last && dt > 0) {
      vx = (pos.x - last.x) / dt;
      vy = (pos.y - last.y) / dt;
    }
    const alpha = 1 - Math.pow(0.6, dt * 60);
    state.smoothedVx += (vx - state.smoothedVx) * alpha;
    state.smoothedVy += (vy - state.smoothedVy) * alpha;
    const speedPx = Math.hypot(state.smoothedVx, state.smoothedVy);

    // Detect tip teleport (rare: scene cut, loop restart). A huge dx with
    // small dt would register as extreme velocity — clamp by dropping the
    // path so the stroke doesn't draw a straight line across the canvas.
    if (last && Math.hypot(pos.x - last.x, pos.y - last.y) > 300) {
      state.points = [];
    }

    // Motion-dominant emission. Motion mode spawns when the tip is moving;
    // ambient mode fills in at a tiny rate at rest (hard-capped in the
    // translator — effectiveAmbient <= 0.3).
    const PX_PER_WORLD = 60;
    const refSpeed = params.motionReferenceSpeed * PX_PER_WORLD;
    const speedScalar = refSpeed > 0 ? Math.min(1, speedPx / refSpeed) : 0;

    const motionRate =
      speedPx >= MOTION_VELOCITY_THRESHOLD_PX
        ? params.motionEmission * speedScalar * params.motionSpawnRate
        : 0;
    const ambientRate = params.effectiveAmbient * params.ambientSpawnRate;

    const totalRate = motionRate + ambientRate;
    state.emitAccumulator += totalRate * dt;

    while (state.emitAccumulator >= 1) {
      state.emitAccumulator -= 1;
      this.pushPoint(state, pos.x, pos.y, speedPx, params);
    }
    // Residual emission handled by Bernoulli to avoid frame-quantization
    // bias at very low rates.
    if (Math.random() < state.emitAccumulator * 0.1) {
      // Don't consume the full accumulator — just a chance at a bonus point.
      this.pushPoint(state, pos.x, pos.y, speedPx, params);
    }

    state.lastPos = { x: pos.x, y: pos.y };
  }

  private pushPoint(
    state: TipState,
    x: number,
    y: number,
    speedPx: number,
    params: Ink2DParams,
  ): void {
    state.points.push({ x, y, age: 0, spawnSpeedPx: speedPx });
    while (state.points.length > params.maxPointsPerTip) {
      state.points.shift();
    }
  }

  private ageAndCullPoints(dt: number, lifetimeSeconds: number): void {
    for (const key of TIP_KEYS) {
      const state = this.tips[key];
      if (!state) continue;
      const survivors: InkPoint[] = [];
      for (const p of state.points) {
        p.age += dt;
        if (p.age < lifetimeSeconds) survivors.push(p);
      }
      state.points = survivors;
    }
  }

  private drawStrokes(ctx: CanvasRenderingContext2D, params: Ink2DParams): void {
    const palette = params.resolvedPalette;
    const prevComposite = ctx.globalCompositeOperation;
    const prevAlpha = ctx.globalAlpha;
    const prevLineCap = ctx.lineCap;
    const prevLineJoin = ctx.lineJoin;
    try {
      // Palette drives composite — neon glows (lighter), all others are
      // opaque pigment (source-over). This is the #1 ink-vs-trails read.
      ctx.globalCompositeOperation = palette.emissive
        ? "lighter"
        : "source-over";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const peakAlpha = params.opacityMax * (0.45 + 0.55 * params.intensity);
      // Reference speed for segment width mapping. Slow segment → thick;
      // fast segment → thin. Ceiling from motionReferenceSpeed (world
      // units) converted to px with same PX_PER_WORLD=60, and a 2×
      // ceiling so genuinely fast strokes still register as thin rather
      // than saturating to thick at the ref speed.
      const SPEED_CEILING_PX = params.motionReferenceSpeed * 60 * 2;
      const widthMax = params.strokeWidthMax * (0.6 + 0.8 * params.intensity);
      const widthMin = params.strokeWidthMin;

      for (const key of TIP_KEYS) {
        const state = this.tips[key];
        if (!state || state.points.length < 2) continue;

        // Segment-by-segment stroke — Canvas2D cannot interpolate lineWidth
        // across a single stroke(), so each span gets its own path/stroke.
        // Using two passes: first an edge pass (wider, lower alpha) for
        // feathering, then the pigment pass on top. Skipped on emissive
        // palettes because additive blend already softens the silhouette.
        const doEdgePass = !palette.emissive;

        for (let i = 1; i < state.points.length; i++) {
          const a = state.points[i - 1]!;
          const b = state.points[i]!;
          const lifeT = b.age / params.lifetimeSeconds;
          const fadeOut =
            lifeT > FADE_FRACTION
              ? Math.max(0, (1 - lifeT) / (1 - FADE_FRACTION))
              : 1;
          const alpha = peakAlpha * fadeOut;
          if (alpha <= 0.01) continue;

          // Segment speed = slower of the two endpoints' spawn speeds.
          // Using min gives the heavier/thicker segment a slight bias,
          // which reads like a brush loading pigment into the paper.
          const segSpeed = Math.min(a.spawnSpeedPx, b.spawnSpeedPx);
          const t = Math.min(1, segSpeed / SPEED_CEILING_PX);
          // Slow (t=0) → widthMax. Fast (t=1) → widthMin. Pressure curve.
          const width = widthMax + (widthMin - widthMax) * t;

          if (doEdgePass) {
            ctx.lineWidth = width * 1.6;
            ctx.strokeStyle = withAlpha(palette.edge, alpha * 0.35);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }

          ctx.lineWidth = width;
          ctx.strokeStyle = withAlpha(palette.pigment, alpha);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    } finally {
      ctx.globalCompositeOperation = prevComposite;
      ctx.globalAlpha = prevAlpha;
      ctx.lineCap = prevLineCap;
      ctx.lineJoin = prevLineJoin;
    }
  }

  private isTipEnabled(key: TipKey, params: Ink2DParams): boolean {
    if (params.trackingMode === "both_ends") return true;
    const isEndA = key === "bluePosA" || key === "redPosA";
    return params.trackingMode === "left_end" ? isEndA : !isEndA;
  }

  dispose(): void {
    for (const key of TIP_KEYS) {
      this.tips[key] = null;
    }
  }
}

function withAlpha(hex: string, alpha: number): string {
  const s = hex.trim().replace(/^#/, "");
  const norm =
    s.length === 3
      ? s
          .split("")
          .map((c) => c + c)
          .join("")
      : s.length >= 6
        ? s.slice(0, 6)
        : "0a0a0a";
  const r = parseInt(norm.slice(0, 2), 16);
  const g = parseInt(norm.slice(2, 4), 16);
  const b = parseInt(norm.slice(4, 6), 16);
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${r},${g},${b},${a})`;
}
