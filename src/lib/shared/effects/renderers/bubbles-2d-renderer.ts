import type { Bubbles2DParams } from "../translators/canvas2d-types";
import type { BubblePalette } from "../domain/bubble-palettes";
import { oilIridescentRim } from "../domain/bubble-palettes";

export interface BubblesTipInput {
  bluePosA: { x: number; y: number } | null;
  bluePosB: { x: number; y: number } | null;
  redPosA: { x: number; y: number } | null;
  redPosB: { x: number; y: number } | null;
}

type TipKey = "bluePosA" | "bluePosB" | "redPosA" | "redPosB";
const TIP_KEYS: TipKey[] = ["bluePosA", "bluePosB", "redPosA", "redPosB"];

/**
 * A single live bubble. Lightweight state - position is integrated each
 * frame instead of closed-form like water droplets because bubbles pick
 * up a bit of horizontal drift and grow over lifetime.
 */
interface Bubble {
  /** Current position (px). */
  x: number;
  y: number;
  /** Horizontal drift velocity (px/s). Small natural chaos. */
  vx: number;
  /** Vertical velocity (px/s). Negative = rising (screen-up). */
  vy: number;
  /** Seconds since spawn. */
  age: number;
  /** Seconds until forced timeout-pop. Max-radius can pop sooner. */
  maxAge: number;
  /** Base radius at spawn (px). */
  baseR: number;
  /** Growth rate - radius grows from baseR toward maxR over lifetime.
   *  0 = no growth (champagne-style), 1 = full growth (soap-style). */
  growthRate: number;
  /** Cap radius (px) for growth + max-size pop trigger. */
  maxR: number;
  /** Pop state. 0 = alive, 1 = popping. */
  popping: number;
  /** Age in popping phase (seconds). Once this exceeds POP_DURATION the
   *  bubble is removed. */
  popAge: number;
  /** Radius frozen at pop-start so the pop animation has a stable base. */
  popR: number;
}

/**
 * A single pop-burst fragment. Short-lived tiny particles that radiate
 * outward from a bubble's pop point.
 */
interface PopBurst {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  maxAge: number;
  /** Size (px). */
  r: number;
  /** Color cached at spawn - avoids per-frame palette lookup when iridescent. */
  color: string;
}

const MAX_BUBBLES = 1024;
const POP_DURATION = 0.12; // seconds - rim expands 1.5× + fades
const POP_MAX_SCALE = 1.5;
const BURST_COUNT_MIN = 4;
const BURST_COUNT_MAX = 8;
const BURST_LIFE_MIN = 0.18;
const BURST_LIFE_VAR = 0.22;
const TAU = Math.PI * 2;

/**
 * Canvas2D bubbles renderer - per-tip buoyant emitter.
 *
 * Each bubble renders as a hollow ringed circle: rim stroke + transparent
 * interior fill + upper-left specular highlight. Motion is simple Euler
 * integration (rise + horizontal drift). Bubbles grow during lifetime and
 * pop either on timeout or when they hit max radius (whichever first).
 * Oil palette samples a hue-shift gradient per frame instead of using a
 * static rim color.
 */
export class Bubbles2DRenderer {
  private bubbles: Bubble[] = [];
  private bursts: PopBurst[] = [];
  private lastTipPos: Partial<Record<TipKey, { x: number; y: number }>> = {};
  private smoothedVelocity: Partial<Record<TipKey, { vx: number; vy: number }>> = {};

  render(
    ctx: CanvasRenderingContext2D,
    params: Bubbles2DParams,
    tips: BubblesTipInput,
    dt: number,
    scale: number = 1,
  ): void {
    const palette = params.resolvedPalette;
    const baseR = params.baseRadius * scale * (0.7 + 0.9 * params.intensity);
    const poolCap = Math.min(MAX_BUBBLES, params.poolSize ?? MAX_BUBBLES);

    // 1. Per-tip velocity smoothing + spawn.
    for (const key of TIP_KEYS) {
      const tip = tips[key];
      if (!tip || !this.isTipEnabled(key, tips, params)) {
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
      if (prev) { prev.vx = svx; prev.vy = svy; } else { this.smoothedVelocity[key] = { vx: svx, vy: svy }; }
      const speedPx = Math.hypot(svx, svy);
      this.spawnBubbles(params, tip, speedPx, dt, scale, baseR, poolCap);
      if (last) { last.x = tip.x; last.y = tip.y; } else { this.lastTipPos[key] = { x: tip.x, y: tip.y }; }
    }

    // 2. Integrate + age + cull.
    this.integrateBubbles(dt, scale, params);
    this.integrateBursts(dt);

    if (this.bubbles.length === 0 && this.bursts.length === 0) return;

    // 3. Draw bubbles (alive + popping).
    this.drawBubbles(ctx, params, palette);

    // 4. Draw pop bursts on top with additive blend.
    this.drawBursts(ctx);
  }

  private spawnBubbles(
    params: Bubbles2DParams,
    tip: { x: number; y: number },
    speedPx: number,
    dt: number,
    scale: number,
    baseR: number,
    poolCap: number,
  ): void {
    if (this.bubbles.length >= poolCap) return;
    const PX_PER_WORLD = 60;
    const refSpeed = params.motionReferenceSpeed * PX_PER_WORLD * scale;
    const speedScalar = refSpeed > 0 ? Math.min(1, speedPx / refSpeed) : 0;
    const ambient = params.ambientEmission * params.ambientSpawnRate;
    const motion =
      params.motionEmission * speedScalar * params.motionSpawnRate;
    const expected = (ambient + motion) * dt;
    let n = Math.floor(expected);
    if (Math.random() < expected - n) n++;
    const slots = poolCap - this.bubbles.length;
    if (n > slots) n = slots;
    if (n <= 0) return;

    // Lifetime scales with intensity - bigger bubbles last longer, but
    // size-pop caps it if they hit maxR first.
    const lifeBase = 1.0 + params.intensity * 2.0;
    // growthRate ∝ (1 - sizeJitter). Low-jitter (champagne) = ~0 growth;
    // high-jitter (soap/dream) = dramatic swell.
    const growth = Math.max(0, 1 - params.sizeJitter);
    // Palette-specific max-size multiplier. Soap + oil + spirit grow more;
    // champagne + acid stay smaller.
    const paletteId = params.resolvedPalette.id;
    const maxSizeMult =
      paletteId === "soap" || paletteId === "oil" || paletteId === "spirit"
        ? 3.0
        : paletteId === "champagne" || paletteId === "acid"
          ? 1.4
          : 2.2; // custom / other

    for (let i = 0; i < n; i++) {
      // Base-radius jitter. sizeJitter controls how wild.
      const jitter =
        1.0 + (Math.random() - 0.5) * 2 * Math.max(0.05, params.sizeJitter);
      const r0 = baseR * jitter;
      // Small origin offset so stacked spawns don't overlap perfectly.
      const ox = (Math.random() - 0.5) * 4 * scale;
      const oy = (Math.random() - 0.5) * 4 * scale;
      // Small horizontal drift + a tiny upward kick so spawn reads as
      // release rather than appearing-in-place.
      const drift = (Math.random() - 0.5) * 30 * scale;
      // Buoyancy maps to upward velocity in screen-space (negative y).
      // 0 → ~20 px/s, 1 → ~120 px/s (before per-frame integration).
      const upSpeed = (20 + params.buoyancy * 100) * scale;
      this.bubbles.push({
        x: tip.x + ox,
        y: tip.y + oy,
        vx: drift,
        vy: -upSpeed,
        age: 0,
        maxAge: lifeBase * (0.7 + Math.random() * 0.6),
        baseR: r0,
        growthRate: growth,
        maxR: r0 * maxSizeMult * (0.85 + Math.random() * 0.3),
        popping: 0,
        popAge: 0,
        popR: r0,
      });
    }
  }

  private integrateBubbles(
    dt: number,
    scale: number,
    params: Bubbles2DParams,
  ): void {
    let writeIdx = 0;
    for (let i = 0; i < this.bubbles.length; i++) {
      const b = this.bubbles[i]!;
      if (b.popping === 1) {
        b.popAge += dt;
        if (b.popAge >= POP_DURATION) continue;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (i !== writeIdx) this.bubbles[writeIdx] = b;
        writeIdx++;
        continue;
      }
      b.age += dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      const currentR = this.currentRadius(b);
      if (b.age >= b.maxAge || currentR >= b.maxR) {
        b.popping = 1;
        b.popAge = 0;
        b.popR = currentR;
        this.spawnBurst(b, params, scale);
      }
      if (i !== writeIdx) this.bubbles[writeIdx] = b;
      writeIdx++;
    }
    this.bubbles.length = writeIdx;
  }

  private integrateBursts(dt: number): void {
    let writeIdx = 0;
    for (let i = 0; i < this.bursts.length; i++) {
      const p = this.bursts[i]!;
      p.age += dt;
      if (p.age >= p.maxAge) continue;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (i !== writeIdx) this.bursts[writeIdx] = p;
      writeIdx++;
    }
    this.bursts.length = writeIdx;
  }

  private spawnBurst(
    b: Bubble,
    params: Bubbles2DParams,
    scale: number,
  ): void {
    const count =
      BURST_COUNT_MIN +
      Math.floor(Math.random() * (BURST_COUNT_MAX - BURST_COUNT_MIN + 1));
    const palette = params.resolvedPalette;
    const staticColor = palette.popBurst;
    const isIridescent = palette.iridescent === true;
    const lifeT = Math.min(1, b.age / b.maxAge);
    const color = isIridescent ? oilIridescentRim(lifeT) : staticColor;
    const speed = 80 + Math.random() * 120;
    for (let i = 0; i < count; i++) {
      const theta = (i / count) * TAU + Math.random() * 0.4;
      const mag = speed * (0.6 + Math.random() * 0.8);
      this.bursts.push({
        x: b.x,
        y: b.y,
        vx: Math.cos(theta) * mag * scale,
        vy: Math.sin(theta) * mag * scale,
        age: 0,
        maxAge: BURST_LIFE_MIN + Math.random() * BURST_LIFE_VAR,
        r: (1.2 + Math.random() * 1.4) * scale,
        color,
      });
    }
  }

  /** Current radius for an alive bubble, accounting for growth. */
  private currentRadius(b: Bubble): number {
    const lifeT = Math.min(1, b.age / b.maxAge);
    // Ease-out - early growth is faster than late. Feels more organic
    // than linear.
    const grow = 1 - Math.pow(1 - lifeT, 1.6);
    const growSpan = b.maxR - b.baseR;
    return b.baseR + growSpan * grow * b.growthRate;
  }

  private drawBubbles(
    ctx: CanvasRenderingContext2D,
    params: Bubbles2DParams,
    palette: BubblePalette,
  ): void {
    const prevAlpha = ctx.globalAlpha;
    const prevCap = ctx.lineCap;
    const prevJoin = ctx.lineJoin;
    const prevComposite = ctx.globalCompositeOperation;
    try {
      ctx.globalCompositeOperation = "source-over";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const iridescent = palette.iridescent === true;
      // Unit-radius specular gradient reused for every bubble. CTM at
      // paint time scales it per bubble - zero per-particle allocation.
      const specGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1.0);
      specGrad.addColorStop(0, palette.highlight);
      specGrad.addColorStop(1, withAlpha(palette.highlight, 0));

      for (const b of this.bubbles) {
        let r: number;
        let alpha: number;
        if (b.popping === 1) {
          const t = b.popAge / POP_DURATION;
          r = b.popR * (1 + (POP_MAX_SCALE - 1) * t);
          alpha = 1 - t;
        } else {
          r = this.currentRadius(b);
          const lifeT = Math.min(1, b.age / b.maxAge);
          const fadeIn = lifeT < 0.08 ? lifeT / 0.08 : 1;
          const fadeOut = lifeT > 0.85 ? 1 - (lifeT - 0.85) / 0.15 : 1;
          alpha = fadeIn * fadeOut;
        }
        if (alpha <= 0.02 || r < 0.5) continue;
        const rim = iridescent
          ? oilIridescentRim(Math.min(1, b.age / b.maxAge))
          : palette.rim;

        ctx.globalAlpha = alpha * 0.9;
        ctx.fillStyle = palette.fill;
        ctx.beginPath();
        ctx.arc(b.x, b.y, r, 0, TAU);
        ctx.fill();

        const rimWidth = Math.max(1, r * 0.08) * (b.popping === 1 ? 1.2 : 1);
        ctx.globalAlpha = alpha;
        ctx.lineWidth = rimWidth;
        ctx.strokeStyle = rim;
        ctx.stroke();

        if (b.popping === 0) {
          const specR = r * 0.22;
          ctx.setTransform(specR, 0, 0, specR, b.x - r * 0.38, b.y - r * 0.42);
          ctx.globalAlpha = alpha * 0.85;
          ctx.fillStyle = specGrad;
          ctx.beginPath();
          ctx.arc(0, 0, 1.0, 0, TAU);
          ctx.fill();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
        }
      }
    } finally {
      ctx.globalAlpha = prevAlpha;
      ctx.lineCap = prevCap;
      ctx.lineJoin = prevJoin;
      ctx.globalCompositeOperation = prevComposite;
    }
  }

  private drawBursts(ctx: CanvasRenderingContext2D): void {
    if (this.bursts.length === 0) return;
    const prevComposite = ctx.globalCompositeOperation;
    const prevAlpha = ctx.globalAlpha;
    try {
      ctx.globalCompositeOperation = "lighter";
      for (const p of this.bursts) {
        const t = p.age / p.maxAge;
        const alpha = 1 - t;
        if (alpha <= 0.02) continue;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, TAU);
        ctx.fill();
      }
    } finally {
      ctx.globalCompositeOperation = prevComposite;
      ctx.globalAlpha = prevAlpha;
    }
  }

  private isTipEnabled(
    key: TipKey,
    tips: BubblesTipInput,
    params: Bubbles2DParams,
  ): boolean {
    if (tips[key] == null) return false;
    if (params.trackingMode === "both_ends") return true;
    const isEndA = key === "bluePosA" || key === "redPosA";
    return params.trackingMode === "left_end" ? isEndA : !isEndA;
  }

  dispose(): void {
    this.bubbles = [];
    this.bursts = [];
    this.lastTipPos = {};
    this.smoothedVelocity = {};
  }
}

function withAlpha(hex: string, alpha: number): string {
  const s = hex.replace("#", "");
  const r = parseInt(s.slice(0, 2), 16);
  const g = parseInt(s.slice(2, 4), 16);
  const b = parseInt(s.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
}
