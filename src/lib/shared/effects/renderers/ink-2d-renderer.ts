import type { Ink2DParams } from "../translators/canvas2d-types";

export interface InkTipInput {
  bluePosA: { x: number; y: number } | null;
  bluePosB: { x: number; y: number } | null;
  redPosA: { x: number; y: number } | null;
  redPosB: { x: number; y: number } | null;
}

type TipKey = "bluePosA" | "bluePosB" | "redPosA" | "redPosB";
const TIP_KEYS: TipKey[] = ["bluePosA", "bluePosB", "redPosA", "redPosB"];

const STAMP_SIZE = 64;
const STAMP_HALF = STAMP_SIZE / 2;
const STAMP_R = STAMP_SIZE * 0.42;

// --- Hash noise for fiber texture (generated at cache time, not per frame) ---

function hashNoise(ix: number, iy: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + seed * 1274126177) | 0;
  h = ((h ^ (h >> 13)) * 1103515245) | 0;
  return (h & 0x7fffffff) / 0x7fffffff;
}

function sampleNoise(x: number, y: number, gridScale: number, seed: number): number {
  const gx = x / gridScale;
  const gy = y / gridScale;
  const ix = Math.floor(gx);
  const iy = Math.floor(gy);
  const fx = gx - ix;
  const fy = gy - iy;
  const n00 = hashNoise(ix, iy, seed);
  const n10 = hashNoise(ix + 1, iy, seed);
  const n01 = hashNoise(ix, iy + 1, seed);
  const n11 = hashNoise(ix + 1, iy + 1, seed);
  const nx0 = n00 + (n10 - n00) * fx;
  const nx1 = n01 + (n11 - n01) * fx;
  return nx0 + (nx1 - nx0) * fy;
}

function twoOctaveNoise(px: number, py: number, seed: number): number {
  return sampleNoise(px, py, 8, seed) * 0.6 + sampleNoise(px, py, 4, seed + 7) * 0.4;
}

// --- Hex color parsing ---

function parseHex(hex: string): [number, number, number] {
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
  return [
    parseInt(norm.slice(0, 2), 16),
    parseInt(norm.slice(2, 4), 16),
    parseInt(norm.slice(4, 6), 16),
  ];
}

// --- BrushStampCache ---

class BrushStampCache {
  private canvas: OffscreenCanvas | HTMLCanvasElement | null = null;
  private signature = "";
  private noiseSeed = (Math.random() * 100000) | 0;

  get(params: Ink2DParams): OffscreenCanvas | HTMLCanvasElement {
    const palette = params.resolvedPalette;
    const sig = `${palette.pigment}|${palette.edge}|${params.intensity.toFixed(2)}|${palette.watercolor ? "w" : ""}|${palette.emissive ? "e" : ""}`;
    if (sig === this.signature && this.canvas) return this.canvas;

    const canvas =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(STAMP_SIZE, STAMP_SIZE)
        : typeof document !== "undefined"
          ? document.createElement("canvas")
          : ({
              width: STAMP_SIZE,
              height: STAMP_SIZE,
              getContext: () => null,
            } as unknown as HTMLCanvasElement);
    if ("width" in canvas) {
      canvas.width = STAMP_SIZE;
      canvas.height = STAMP_SIZE;
    }
    const ctx = canvas.getContext("2d") as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D;
    if (!ctx) {
      this.canvas = canvas;
      this.signature = sig;
      return canvas;
    }

    const cx = STAMP_HALF;
    const cy = STAMP_HALF;
    const R = STAMP_R;
    const [pr, pg, pb] = parseHex(palette.pigment);
    const [er, eg, eb] = parseHex(palette.edge);

    ctx.clearRect(0, 0, STAMP_SIZE, STAMP_SIZE);

    // Layer 1: Core pigment
    const grad1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    grad1.addColorStop(0, `rgba(${pr},${pg},${pb},0.95)`);
    grad1.addColorStop(0.55, `rgba(${pr},${pg},${pb},0.7)`);
    grad1.addColorStop(1, `rgba(${pr},${pg},${pb},0)`);
    ctx.fillStyle = grad1;
    ctx.fillRect(0, 0, STAMP_SIZE, STAMP_SIZE);

    // Layer 2: Wet edge ring (skip for watercolor)
    if (!palette.watercolor) {
      const ringAlpha = palette.emissive ? 0.6 : 0.4;
      const grad2 = ctx.createRadialGradient(cx, cy, R * 0.55, cx, cy, R * 0.95);
      grad2.addColorStop(0, `rgba(${pr},${pg},${pb},0)`);
      grad2.addColorStop(0.35, `rgba(${pr},${pg},${pb},${ringAlpha})`);
      grad2.addColorStop(0.65, `rgba(${pr},${pg},${pb},${ringAlpha * 0.7})`);
      grad2.addColorStop(1, `rgba(${pr},${pg},${pb},0)`);
      ctx.fillStyle = grad2;
      ctx.fillRect(0, 0, STAMP_SIZE, STAMP_SIZE);
    }

    // Layer 3: Edge bleed
    const grad3 = ctx.createRadialGradient(cx, cy, R * 0.7, cx, cy, R * 1.1);
    grad3.addColorStop(0, `rgba(${er},${eg},${eb},0)`);
    grad3.addColorStop(1, `rgba(${er},${eg},${eb},0.2)`);
    ctx.fillStyle = grad3;
    ctx.fillRect(0, 0, STAMP_SIZE, STAMP_SIZE);

    // Layer 4: Fiber noise
    const noiseStrength = palette.watercolor ? 0.15 : palette.emissive ? 0.2 : 1.0;
    if (noiseStrength > 0.05) {
      const imgData = ctx.getImageData(0, 0, STAMP_SIZE, STAMP_SIZE);
      const data = imgData.data;
      for (let py = 0; py < STAMP_SIZE; py++) {
        for (let px = 0; px < STAMP_SIZE; px++) {
          const idx = (py * STAMP_SIZE + px) * 4;
          if (data[idx + 3]! === 0) continue;
          const n = twoOctaveNoise(px, py, this.noiseSeed);
          const factor = 0.5 + 0.5 * n;
          const blend = 1.0 - noiseStrength + noiseStrength * factor;
          data[idx + 3] = Math.round(data[idx + 3]! * blend);
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }

    this.canvas = canvas;
    this.signature = sig;
    return canvas;
  }

  dispose(): void {
    this.canvas = null;
    this.signature = "";
  }
}

// --- InkPoint with velocity for gravity ---

interface InkPoint {
  x: number;
  y: number;
  vy: number;
  age: number;
  spawnSpeedPx: number;
  tangentAngle: number;
  jitterSeed: number;
}

interface TipState {
  points: InkPoint[];
  lastPos: { x: number; y: number } | null;
  smoothedVx: number;
  smoothedVy: number;
  emitAccumulator: number;
}

// --- Droplet from strand breakup ---

interface InkDroplet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  maxAge: number;
  radius: number;
  jitterSeed: number;
}

const MOTION_VELOCITY_THRESHOLD_PX = 30;
const FADE_FRACTION = 0.6;
const MAX_ROTATION_JITTER = 0.14;
const MAX_SCALE_JITTER = 0.24;
const MAX_OPACITY_JITTER = 0.15;
const DROPLET_DRIFT_PX = 30;

function jitterHash(seed: number, channel: number): number {
  let h = ((seed * 1000000) | 0) + channel * 374761393;
  h = ((h ^ (h >> 13)) * 1103515245) | 0;
  return (h & 0x7fffffff) / 0x7fffffff;
}

export class Ink2DRenderer {
  private tips: Record<TipKey, TipState | null> = {
    bluePosA: null,
    bluePosB: null,
    redPosA: null,
    redPosB: null,
  };
  private stampCache = new BrushStampCache();
  private droplets: InkDroplet[] = [];

  render(
    ctx: CanvasRenderingContext2D,
    params: Ink2DParams,
    tips: InkTipInput,
    dt: number,
    _scale: number = 1,
  ): void {
    for (const key of TIP_KEYS) {
      const pos = tips[key];
      const enabled = this.isTipEnabled(key, params);
      if (!pos || !enabled) {
        // Don't clear state - let existing points sag, break, and age out.
        // Only clear lastPos so the next appearance doesn't teleport.
        const state = this.tips[key];
        if (state) state.lastPos = null;
        continue;
      }
      this.updateTip(key, pos, params, dt);
    }
    this.applyGravityAndCull(dt, params);
    this.detectBreakup(params);
    this.advanceDroplets(dt, params, ctx.canvas.height);
    this.drawStamps(ctx, params);
    this.drawDroplets(ctx, params);
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
      };
      this.tips[key] = state;
      return;
    }

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

    if (last && Math.hypot(pos.x - last.x, pos.y - last.y) > 300) {
      state.points = [];
    }

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

    const tangent = Math.atan2(state.smoothedVy, state.smoothedVx);

    const speedT = Math.min(1, speedPx / (params.motionReferenceSpeed * PX_PER_WORLD * 2));
    const currentScale =
      params.stampScaleMax + (params.stampScaleMin - params.stampScaleMax) * speedT;
    const brushWidth = STAMP_SIZE * currentScale;
    const minSpacing = brushWidth * 0.22;

    while (state.emitAccumulator >= 1) {
      state.emitAccumulator -= 1;
      if (this.canEmit(state, pos.x, pos.y, minSpacing)) {
        this.pushPoint(state, pos.x, pos.y, speedPx, tangent, params);
      }
    }
    if (Math.random() < state.emitAccumulator * 0.1) {
      if (this.canEmit(state, pos.x, pos.y, minSpacing)) {
        this.pushPoint(state, pos.x, pos.y, speedPx, tangent, params);
      }
    }

    state.lastPos = { x: pos.x, y: pos.y };
  }

  private canEmit(state: TipState, x: number, y: number, minSpacing: number): boolean {
    if (state.points.length === 0) return true;
    const last = state.points[state.points.length - 1]!;
    return Math.hypot(x - last.x, y - last.y) >= minSpacing;
  }

  private pushPoint(
    state: TipState,
    x: number,
    y: number,
    speedPx: number,
    tangentAngle: number,
    params: Ink2DParams,
  ): void {
    state.points.push({
      x,
      y,
      vy: 0,
      age: 0,
      spawnSpeedPx: speedPx,
      tangentAngle,
      jitterSeed: Math.random(),
    });
    while (state.points.length > params.maxPointsPerTip) {
      state.points.shift();
    }
  }

  private applyGravityAndCull(dt: number, params: Ink2DParams): void {
    const gravity = params.gravityPx;
    for (const key of TIP_KEYS) {
      const state = this.tips[key];
      if (!state) continue;
      const survivors: InkPoint[] = [];
      for (const p of state.points) {
        p.age += dt;
        p.vy += gravity * dt;
        p.y += p.vy * dt;
        if (p.age < params.lifetimeSeconds) survivors.push(p);
      }
      state.points = survivors;
    }
  }

  private detectBreakup(params: Ink2DParams): void {
    const threshold = (1 - params.viscosity) * params.breakStretchMax;
    if (threshold <= 0) {
      // viscosity=1: everything breaks immediately - convert all aged points
      for (const key of TIP_KEYS) {
        const state = this.tips[key];
        if (!state || state.points.length < 2) continue;
        const keep: InkPoint[] = [];
        for (const p of state.points) {
          if (p.age > 0.05) {
            this.spawnDropletFromPoint(p, params);
          } else {
            keep.push(p);
          }
        }
        state.points = keep;
      }
      return;
    }

    for (const key of TIP_KEYS) {
      const state = this.tips[key];
      if (!state || state.points.length < 2) continue;

      // Walk oldest→newest, find first break point
      let breakIdx = -1;
      for (let i = 0; i < state.points.length - 1; i++) {
        const a = state.points[i]!;
        const b = state.points[i + 1]!;
        if (Math.hypot(b.x - a.x, b.y - a.y) > threshold) {
          breakIdx = i;
          break;
        }
      }

      if (breakIdx >= 0) {
        // Detach points 0..breakIdx → droplets
        const detached = state.points.splice(0, breakIdx + 1);
        for (const p of detached) {
          this.spawnDropletFromPoint(p, params);
        }
      }
    }
  }

  private spawnDropletFromPoint(p: InkPoint, params: Ink2DParams): void {
    if (this.droplets.length >= params.dropletPoolSize) return;
    this.droplets.push({
      x: p.x,
      y: p.y,
      vx: (Math.random() - 0.5) * DROPLET_DRIFT_PX * 2,
      vy: p.vy,
      age: 0,
      maxAge: params.dropletMaxAge * (0.7 + Math.random() * 0.6),
      radius: 3 + Math.random() * 5,
      jitterSeed: p.jitterSeed,
    });
  }

  private advanceDroplets(dt: number, params: Ink2DParams, canvasHeight: number): void {
    const gravity = params.gravityPx;
    const survivors: InkDroplet[] = [];
    for (const d of this.droplets) {
      d.vy += gravity * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.age += dt;
      if (d.age < d.maxAge && d.y < canvasHeight + 50) {
        survivors.push(d);
      }
    }
    this.droplets = survivors;
  }

  private drawStamps(ctx: CanvasRenderingContext2D, params: Ink2DParams): void {
    const stamp = this.stampCache.get(params);
    const palette = params.resolvedPalette;
    const prevComposite = ctx.globalCompositeOperation;
    const prevAlpha = ctx.globalAlpha;
    const composite: GlobalCompositeOperation = palette.emissive ? "lighter" : "source-over";

    try {
      ctx.globalCompositeOperation = composite;

      const peakAlpha = params.opacityMax * (0.45 + 0.55 * params.intensity);
      const watercolorCap = palette.watercolor ? 0.35 : 1.0;
      const SPEED_CEILING_PX = params.motionReferenceSpeed * 60 * 2;
      const watercolorScale = palette.watercolor ? 1.8 : 1.0;
      const bleedAlphaMultiplier = palette.watercolor ? 0.3 : 0.18;

      for (const key of TIP_KEYS) {
        const state = this.tips[key];
        if (!state || state.points.length === 0) continue;

        // Edge bleed pass
        for (const p of state.points) {
          const ageT = p.age / params.lifetimeSeconds;
          const fadeOut =
            ageT > FADE_FRACTION ? Math.max(0, (1 - ageT) / (1 - FADE_FRACTION)) : 1;
          const baseAlpha = Math.min(peakAlpha * fadeOut, watercolorCap);
          if (baseAlpha <= 0.01) continue;

          const speedT = Math.min(1, p.spawnSpeedPx / SPEED_CEILING_PX);
          const scale =
            (params.stampScaleMax + (params.stampScaleMin - params.stampScaleMax) * speedT) *
            watercolorScale;
          const scaleJitter = 1.0 + (jitterHash(p.jitterSeed, 1) - 0.5) * MAX_SCALE_JITTER;
          const rotJitter = (jitterHash(p.jitterSeed, 0) - 0.5) * MAX_ROTATION_JITTER;
          const bleedScale = scale * scaleJitter * 1.7;

          ctx.globalAlpha = baseAlpha * bleedAlphaMultiplier;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.tangentAngle + rotJitter);
          const squash = 1.0 / Math.sqrt(1.0 + speedT * 0.4);
          ctx.scale(bleedScale, bleedScale * squash);
          ctx.drawImage(stamp, -STAMP_HALF, -STAMP_HALF);
          ctx.restore();
        }

        // Pigment pass
        for (const p of state.points) {
          const ageT = p.age / params.lifetimeSeconds;
          const fadeOut =
            ageT > FADE_FRACTION ? Math.max(0, (1 - ageT) / (1 - FADE_FRACTION)) : 1;
          const baseAlpha = Math.min(peakAlpha * fadeOut, watercolorCap);
          if (baseAlpha <= 0.01) continue;

          const speedT = Math.min(1, p.spawnSpeedPx / SPEED_CEILING_PX);
          const scale =
            (params.stampScaleMax + (params.stampScaleMin - params.stampScaleMax) * speedT) *
            watercolorScale;
          const scaleJitter = 1.0 + (jitterHash(p.jitterSeed, 1) - 0.5) * MAX_SCALE_JITTER;
          const rotJitter = (jitterHash(p.jitterSeed, 0) - 0.5) * MAX_ROTATION_JITTER;
          const opacityJitter = 1.0 - jitterHash(p.jitterSeed, 2) * MAX_OPACITY_JITTER;

          ctx.globalAlpha = baseAlpha * opacityJitter;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.tangentAngle + rotJitter);
          const squash = 1.0 / Math.sqrt(1.0 + speedT * 0.4);
          ctx.scale(scale * scaleJitter, scale * scaleJitter * squash);
          ctx.drawImage(stamp, -STAMP_HALF, -STAMP_HALF);
          ctx.restore();
        }
      }
    } finally {
      ctx.globalCompositeOperation = prevComposite;
      ctx.globalAlpha = prevAlpha;
    }
  }

  private drawDroplets(ctx: CanvasRenderingContext2D, params: Ink2DParams): void {
    if (this.droplets.length === 0) return;
    const stamp = this.stampCache.get(params);
    const palette = params.resolvedPalette;
    const prevComposite = ctx.globalCompositeOperation;
    const prevAlpha = ctx.globalAlpha;
    const composite: GlobalCompositeOperation = palette.emissive ? "lighter" : "source-over";

    try {
      ctx.globalCompositeOperation = composite;
      const peakAlpha = params.opacityMax * (0.45 + 0.55 * params.intensity);
      const watercolorCap = palette.watercolor ? 0.35 : 1.0;

      for (const d of this.droplets) {
        const ageT = d.age / d.maxAge;
        const fadeOut =
          ageT > FADE_FRACTION ? Math.max(0, (1 - ageT) / (1 - FADE_FRACTION)) : 1;
        const alpha = Math.min(peakAlpha * fadeOut, watercolorCap);
        if (alpha <= 0.01) continue;

        const scale = d.radius / STAMP_HALF;
        const rotation = Math.atan2(d.vy, d.vx);

        ctx.globalAlpha = alpha;
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(rotation);
        ctx.scale(scale, scale);
        ctx.drawImage(stamp, -STAMP_HALF, -STAMP_HALF);
        ctx.restore();
      }
    } finally {
      ctx.globalCompositeOperation = prevComposite;
      ctx.globalAlpha = prevAlpha;
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
    this.stampCache.dispose();
    this.droplets = [];
  }
}
