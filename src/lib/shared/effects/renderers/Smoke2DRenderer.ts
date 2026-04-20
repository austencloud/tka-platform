import type { Smoke2DParams } from "../translators/canvas2d-types";
import { SampledCurlGrid2D } from "$lib/shared/3d/effects/smoke/SmokeCurlField";

export interface SmokeTipInput {
  bluePosA: { x: number; y: number } | null;
  bluePosB: { x: number; y: number } | null;
  redPosA: { x: number; y: number } | null;
  redPosB: { x: number; y: number } | null;
}

type TipKey = "bluePosA" | "bluePosB" | "redPosA" | "redPosB";
const TIP_KEYS: TipKey[] = ["bluePosA", "bluePosB", "redPosA", "redPosB"];

/**
 * A single live puff particle.
 *
 * Position is integrated each frame by a curl-noise velocity (swirling
 * horizontal component) plus a world-up rise (upward screen-space = -y).
 * Radius grows over lifetime — smoke reads as expanding, not as a solid
 * disc — and alpha fades over the last 30% of life.
 */
interface SmokePuff {
  /** Current position (px). */
  x: number;
  y: number;
  /** Horizontal velocity (px/s). Updated each frame from curl field. */
  vx: number;
  /** Vertical velocity (px/s). Negative = rising (screen-up). */
  vy: number;
  /** Seconds since spawn. */
  age: number;
  /** Total lifetime (seconds). */
  maxAge: number;
  /** Radius at spawn (px). */
  r0: number;
  /** Max radius at end of life (px). Puff grows linearly across life. */
  r1: number;
  /** Base alpha at peak (0-1). Palette intensity + intent modulate this. */
  peakAlpha: number;
  /** Per-puff phase for the noise sample — keeps emitted puffs from all sampling the exact same curl cell on their first frame. */
  noisePhase: number;
}

const TAU = Math.PI * 2;
const FADE_OUT_FRACTION = 0.3; // last 30% of life fades alpha out
const FADE_IN_DURATION = 0.15; // seconds — soft birth, avoids hard pop-in

/**
 * Canvas2D smoke renderer — per-tip curl-noise puff emitter.
 *
 * Each puff is drawn as a radial-gradient circle (core → edge →
 * transparent). Motion combines:
 *   - vy  = palette-biased rise speed (negative = up)
 *   - curl(position, time) × resolvedCurlStrength
 *
 * Curl noise is sampled from a pre-baked grid (`SampledCurlGrid2D`) that
 * regenerates at ~3 Hz — a one-time cost of ~12k simplex calls every
 * 333ms instead of 245k calls/sec direct sampling at high tier.
 *
 * Pool saturation policy: when the pool is full, new spawn attempts are
 * dropped — we do NOT recycle alive particles. Fog palette at max spawn
 * will hit the density cap and stay there until older puffs age out,
 * which reads as a natural density plateau, not pop-out artifacts.
 */
export class Smoke2DRenderer {
  private puffs: SmokePuff[] = [];
  private lastTipPos: Partial<Record<TipKey, { x: number; y: number }>> = {};
  private smoothedVelocity: Partial<Record<TipKey, { vx: number; vy: number }>> = {};
  private clock = 0;
  // One shared curl field across tips. Domain of 16 world-space-ish units
  // at noiseScale=0.5 gives a coherent eddy pattern at the ~800px canvas
  // scale without visible tiling seams.
  private readonly curlField = new SampledCurlGrid2D(64, 16, 1 / 3);

  render(
    ctx: CanvasRenderingContext2D,
    params: Smoke2DParams,
    tips: SmokeTipInput,
    dt: number,
    scale: number = 1,
  ): void {
    this.clock += dt;
    const palette = params.resolvedPalette;
    const baseRadius = params.baseRadius * scale * (0.7 + 0.9 * params.intensity);
    const poolCap = Math.min(params.poolSize ?? 1024, 4096);

    // 1. Per-tip velocity smoothing + spawn.
    for (const key of TIP_KEYS) {
      const tip = tips[key];
      if (!tip || !this.isTipEnabled(key, params)) {
        delete this.lastTipPos[key];
        delete this.smoothedVelocity[key];
        continue;
      }
      const last = this.lastTipPos[key];
      let vx = 0;
      let vy = 0;
      if (last && dt > 0) {
        vx = (tip.x - last.x) / dt;
        vy = (tip.y - last.y) / dt;
      }
      const prev = this.smoothedVelocity[key];
      const alpha = 1 - Math.pow(0.6, dt * 60);
      const svx = prev ? prev.vx + (vx - prev.vx) * alpha : vx;
      const svy = prev ? prev.vy + (vy - prev.vy) * alpha : vy;
      this.smoothedVelocity[key] = { vx: svx, vy: svy };
      const speedPx = Math.hypot(svx, svy);
      this.spawnPuffs(params, tip, speedPx, dt, scale, baseRadius, poolCap);
      this.lastTipPos[key] = { x: tip.x, y: tip.y };
    }

    // 2. Integrate + age + cull.
    this.integratePuffs(dt, params, scale);

    if (this.puffs.length === 0) return;

    // 3. Draw.
    this.drawPuffs(ctx, palette);
  }

  private spawnPuffs(
    params: Smoke2DParams,
    tip: { x: number; y: number },
    speedPx: number,
    dt: number,
    scale: number,
    baseRadius: number,
    poolCap: number,
  ): void {
    if (this.puffs.length >= poolCap) return;
    // Match other emitters' speed scalar: convert world-speed reference
    // to a px scale via a 60:1 pixel-per-world rule so the motion
    // sensitivity lines up with bubbles/petals.
    const PX_PER_WORLD = 60;
    const refSpeed = params.motionReferenceSpeed * PX_PER_WORLD * scale;
    const speedScalar = refSpeed > 0 ? Math.min(1, speedPx / refSpeed) : 0;
    const ambient = params.ambientEmission * params.ambientSpawnRate;
    const motion = params.motionEmission * speedScalar * params.motionSpawnRate;
    const expected = (ambient + motion) * dt;
    let n = Math.floor(expected);
    if (Math.random() < expected - n) n++;
    const slots = poolCap - this.puffs.length;
    if (n > slots) n = slots;
    if (n <= 0) return;

    const lifetime = params.lifetimeSeconds;
    // Expansion ratio — puffs roughly triple in radius over life.
    const growthRatio = 3.0;

    for (let i = 0; i < n; i++) {
      const jitter = 0.8 + Math.random() * 0.4;
      const r0 = baseRadius * jitter;
      const r1 = r0 * growthRatio * (0.8 + Math.random() * 0.4);
      const ox = (Math.random() - 0.5) * 8 * scale;
      const oy = (Math.random() - 0.5) * 6 * scale;
      // Spec: ±20% per-particle lifetime jitter.
      const lifeJitter = 0.8 + Math.random() * 0.4;
      // Intent's `intensity` multiplies the per-puff alpha peak; palette
      // isn't colorable-translucency aware so we keep this on the emitter.
      const peakAlpha = 0.25 + 0.45 * params.intensity;
      this.puffs.push({
        x: tip.x + ox,
        y: tip.y + oy,
        // Small initial outward drift so fresh puffs don't stack.
        vx: (Math.random() - 0.5) * 20 * scale,
        // Negative = up in screen space.
        vy: -params.resolvedRiseSpeed * scale * (0.85 + Math.random() * 0.3),
        age: 0,
        maxAge: lifetime * lifeJitter,
        r0,
        r1,
        peakAlpha,
        noisePhase: Math.random() * TAU,
      });
    }
  }

  private integratePuffs(dt: number, params: Smoke2DParams, scale: number): void {
    const survivors: SmokePuff[] = [];
    const curlStrength = params.resolvedCurlStrength;
    // noiseScale is world-units per radian; we bake the curl grid in
    // world units and scale position → world via 1/(noiseScale × PX_PER_WORLD).
    const PX_PER_WORLD = 60;
    const worldScale = 1 / (params.noiseScale * PX_PER_WORLD * scale);
    for (const p of this.puffs) {
      p.age += dt;
      if (p.age >= p.maxAge) continue;
      // Curl sample: position mapped to grid world coords, plus a per-
      // puff noise phase offset so neighbouring puffs don't sample the
      // same cell perfectly in sync.
      const wx = p.x * worldScale + p.noisePhase;
      const wy = p.y * worldScale;
      const curl = this.curlField.sample(wx, wy, this.clock);
      // Curl magnitude baseline: the sampled output is roughly [-1, 1],
      // so a curl-scale px/sec conversion lets user-facing curlStrength=1
      // move a puff ~80 px/s laterally (visible but not chaotic).
      const CURL_BASE_PX = 80 * scale;
      const cx = curl.vx * curlStrength * CURL_BASE_PX;
      const cy = curl.vy * curlStrength * CURL_BASE_PX;
      p.x += (p.vx + cx) * dt;
      p.y += (p.vy + cy) * dt;
      // Light drag so horizontal drift doesn't accumulate forever on
      // long-lived puffs (fog palette at 12s lifetime).
      const drag = Math.pow(0.4, dt);
      p.vx *= drag;
      survivors.push(p);
    }
    this.puffs = survivors;
  }

  private drawPuffs(
    ctx: CanvasRenderingContext2D,
    palette: { core: string; edge: string; hueShift?: boolean },
  ): void {
    const prevAlpha = ctx.globalAlpha;
    const prevComposite = ctx.globalCompositeOperation;
    try {
      ctx.globalCompositeOperation = "source-over";
      const { r: cr, g: cg, b: cb } = hexToRgb(palette.core);
      const { r: er, g: eg, b: eb } = hexToRgb(palette.edge);
      for (const p of this.puffs) {
        const lifeT = p.age / p.maxAge;
        const fadeIn = p.age < FADE_IN_DURATION ? p.age / FADE_IN_DURATION : 1;
        const fadeOut =
          lifeT > 1 - FADE_OUT_FRACTION
            ? (1 - lifeT) / FADE_OUT_FRACTION
            : 1;
        const alpha = Math.max(0, fadeIn * fadeOut * p.peakAlpha);
        if (alpha <= 0.02) continue;

        const radius = p.r0 + (p.r1 - p.r0) * lifeT;

        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
        grad.addColorStop(0, `rgba(${cr},${cg},${cb},${alpha})`);
        grad.addColorStop(0.55, `rgba(${er},${eg},${eb},${alpha * 0.55})`);
        grad.addColorStop(1, `rgba(${er},${eg},${eb},0)`);

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, TAU);
        ctx.fill();
      }
    } finally {
      ctx.globalAlpha = prevAlpha;
      ctx.globalCompositeOperation = prevComposite;
    }
  }

  private isTipEnabled(key: TipKey, params: Smoke2DParams): boolean {
    if (params.trackingMode === "both_ends") return true;
    const isEndA = key === "bluePosA" || key === "redPosA";
    return params.trackingMode === "left_end" ? isEndA : !isEndA;
  }

  dispose(): void {
    this.puffs = [];
    this.lastTipPos = {};
    this.smoothedVelocity = {};
    this.clock = 0;
  }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const s = hex.trim().replace(/^#/, "");
  const norm =
    s.length === 3
      ? s
          .split("")
          .map((c) => c + c)
          .join("")
      : s.length >= 6
        ? s.slice(0, 6)
        : "d8d8d8";
  return {
    r: parseInt(norm.slice(0, 2), 16),
    g: parseInt(norm.slice(2, 4), 16),
    b: parseInt(norm.slice(4, 6), 16),
  };
}
