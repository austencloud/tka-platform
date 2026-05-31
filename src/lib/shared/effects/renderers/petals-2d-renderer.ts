import type { Petals2DParams } from "../translators/canvas2d-types";
import type { PetalPalette, PetalSpriteShape } from "../domain/petal-palettes";
import {
  drawPetalSilhouette,
  drawPetalEmberRim,
  pickPetalSprite,
  pickPetalTint,
  rollEmberFlag,
} from "../domain/petal-palettes";

export interface PetalsTipInput {
  bluePosA: { x: number; y: number } | null;
  bluePosB: { x: number; y: number } | null;
  redPosA: { x: number; y: number } | null;
  redPosB: { x: number; y: number } | null;
}

type TipKey = "bluePosA" | "bluePosB" | "redPosA" | "redPosB";
const TIP_KEYS: TipKey[] = ["bluePosA", "bluePosB", "redPosA", "redPosB"];

/**
 * A single live petal. Lightweight state integrated each frame.
 *
 * 2D petals fall from the tip along a sinusoidal sway curve, rotating
 * gently around their sprite center at a rate proportional to horizontal
 * velocity (so a sharp flutter spins the petal faster than a slow drift).
 */
interface Petal {
  /** Current position (px). */
  x: number;
  y: number;
  /** Horizontal velocity (px/s). Updated each frame from sway + drift. */
  vx: number;
  /** Vertical velocity (px/s). Positive = down (screen-space). */
  vy: number;
  /** Seconds since spawn. */
  age: number;
  /** Total lifetime (seconds). */
  maxAge: number;
  /** Sprite-half-size (px). */
  size: number;
  /** Sprite silhouette shape. */
  shape: PetalSpriteShape;
  /** Tint (hex). */
  tint: string;
  /** Current rotation angle (radians). */
  rot: number;
  /** Angular velocity coefficient - per-petal scalar so flutter feels individual. */
  rotK: number;
  /** Per-petal phase offset for sway so petals don't sync. */
  phase: number;
  /** True if this petal has an ember rim (ash palette, 20% chance). */
  ember: boolean;
}

const MAX_PETALS = 2048;
const FADE_OUT_FRACTION = 0.2; // last 20% of life fades alpha out
const FADE_IN_DURATION = 0.12; // seconds
const EMBER_MAX_AGE = 0.4; // seconds - ember glow dies well before petal
const TAU = Math.PI * 2;

/**
 * Canvas2D petals renderer - per-tip falling sprite emitter with
 * sinusoidal sway. Silhouettes are drawn procedurally from the palette's
 * shape list; no PNG atlases required.
 *
 * Ember rim (ash palette only): particles flagged at spawn get a short
 * orange additive glow along their silhouette edge that dies over the
 * first 400ms while the petal continues its normal lifetime.
 */
export class Petals2DRenderer {
  private petals: Petal[] = [];
  private lastTipPos: Partial<Record<TipKey, { x: number; y: number }>> = {};
  private smoothedVelocity: Partial<Record<TipKey, { vx: number; vy: number }>> = {};
  private clock = 0;

  render(
    ctx: CanvasRenderingContext2D,
    params: Petals2DParams,
    tips: PetalsTipInput,
    dt: number,
    scale: number = 1,
  ): void {
    this.clock += dt;
    const palette = params.resolvedPalette;
    const baseSize = params.baseSize * scale * (0.7 + 0.9 * params.intensity);
    const poolCap = Math.min(MAX_PETALS, params.poolSize ?? MAX_PETALS);

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
      this.spawnPetals(params, palette, tip, speedPx, dt, scale, baseSize, poolCap);
      if (last) { last.x = tip.x; last.y = tip.y; } else { this.lastTipPos[key] = { x: tip.x, y: tip.y }; }
    }

    // 2. Integrate + age + cull.
    this.integratePetals(dt, params);

    if (this.petals.length === 0) return;

    // 3. Draw.
    this.drawPetals(ctx, palette);
  }

  private spawnPetals(
    params: Petals2DParams,
    palette: PetalPalette,
    tip: { x: number; y: number },
    speedPx: number,
    dt: number,
    scale: number,
    baseSize: number,
    poolCap: number,
  ): void {
    if (this.petals.length >= poolCap) return;
    const PX_PER_WORLD = 60;
    const refSpeed = params.motionReferenceSpeed * PX_PER_WORLD * scale;
    const speedScalar = refSpeed > 0 ? Math.min(1, speedPx / refSpeed) : 0;
    const ambient = params.ambientEmission * params.ambientSpawnRate;
    const motion = params.motionEmission * speedScalar * params.motionSpawnRate;
    const expected = (ambient + motion) * dt;
    let n = Math.floor(expected);
    if (Math.random() < expected - n) n++;
    const slots = poolCap - this.petals.length;
    if (n > slots) n = slots;
    if (n <= 0) return;

    const fall = params.fallBaseSpeed * (0.3 + 0.7 * params.fallSpeed) * scale;
    // Lifetime scales with intensity - bigger petals last longer because
    // they fall slower relative to their size.
    const lifeBase = 2.0 + params.intensity * 3.0;

    for (let i = 0; i < n; i++) {
      const jitter = 0.7 + Math.random() * 0.6;
      const size = baseSize * jitter;
      const ox = (Math.random() - 0.5) * 8 * scale;
      const oy = (Math.random() - 0.5) * 6 * scale;
      // Small horizontal drift independent of sway.
      const drift = (Math.random() - 0.5) * 40 * scale;
      this.petals.push({
        x: tip.x + ox,
        y: tip.y + oy,
        vx: drift,
        vy: fall * (0.8 + Math.random() * 0.4),
        age: 0,
        maxAge: lifeBase * (0.8 + Math.random() * 0.4),
        size,
        shape: pickPetalSprite(palette),
        tint: pickPetalTint(palette),
        rot: Math.random() * TAU,
        rotK: (Math.random() - 0.5) * 0.012,
        phase: Math.random() * TAU,
        ember: rollEmberFlag(palette),
      });
    }
  }

  private integratePetals(dt: number, params: Petals2DParams): void {
    const swayFreq = params.swayFrequency;
    const swayBase = params.swayBaseSpeed * params.swayAmplitude;
    let writeIdx = 0;
    for (let i = 0; i < this.petals.length; i++) {
      const p = this.petals[i]!;
      p.age += dt;
      if (p.age >= p.maxAge) continue;
      const swayX = Math.sin(p.phase + this.clock * swayFreq * TAU) * swayBase;
      p.x += (p.vx + swayX) * dt;
      p.y += p.vy * dt;
      p.rot += (swayX * p.rotK + p.vx * 0.0008) * dt * 60;
      if (i !== writeIdx) this.petals[writeIdx] = p;
      writeIdx++;
    }
    this.petals.length = writeIdx;
  }

  private drawPetals(
    ctx: CanvasRenderingContext2D,
    palette: PetalPalette,
  ): void {
    const prevAlpha = ctx.globalAlpha;
    const prevComposite = ctx.globalCompositeOperation;
    const savedTransform = ctx.getTransform();
    try {
      ctx.globalCompositeOperation = "source-over";
      for (const p of this.petals) {
        const lifeT = p.age / p.maxAge;
        const fadeIn = p.age < FADE_IN_DURATION ? p.age / FADE_IN_DURATION : 1;
        const fadeOut =
          lifeT > 1 - FADE_OUT_FRACTION
            ? (1 - lifeT) / FADE_OUT_FRACTION
            : 1;
        const alpha = Math.max(0, fadeIn * fadeOut);
        if (alpha <= 0.02) continue;

        const cos = Math.cos(p.rot);
        const sin = Math.sin(p.rot);
        ctx.setTransform(cos, sin, -sin, cos, p.x, p.y);
        ctx.globalAlpha = alpha;
        drawPetalSilhouette(ctx, p.shape, p.size, p.tint);
        if (p.ember && palette.emberEdge && p.age < EMBER_MAX_AGE) {
          const emberT = p.age / EMBER_MAX_AGE;
          const emberAlpha = (1 - emberT) * alpha * 0.9;
          if (emberAlpha > 0.02) {
            drawPetalEmberRim(
              ctx,
              p.shape,
              p.size,
              palette.emberEdge.color,
              emberAlpha,
            );
          }
        }
      }
    } finally {
      ctx.setTransform(savedTransform);
      ctx.globalAlpha = prevAlpha;
      ctx.globalCompositeOperation = prevComposite;
    }
  }

  private isTipEnabled(
    key: TipKey,
    tips: PetalsTipInput,
    params: Petals2DParams,
  ): boolean {
    if (tips[key] == null) return false;
    if (params.trackingMode === "both_ends") return true;
    const isEndA = key === "bluePosA" || key === "redPosA";
    return params.trackingMode === "left_end" ? isEndA : !isEndA;
  }

  dispose(): void {
    this.petals = [];
    this.lastTipPos = {};
    this.smoothedVelocity = {};
    this.clock = 0;
  }
}
