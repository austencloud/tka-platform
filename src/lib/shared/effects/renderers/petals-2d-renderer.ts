import type { Petals2DParams } from "../translators/canvas2d-types";
import type { PetalPalette, PetalSpriteShape } from "../domain/petal-palettes";
import {
  drawPetalSilhouette,
  drawPetalEmberRim,
  pickPetalSprite,
  pickPetalTint,
  resolvePetalOpacity,
  resolvePetalSize,
  rollEmberFlag,
} from "../domain/petal-palettes";
import {
  addPetalWake2D,
  resolvePetalAirflowPhrase,
  samplePetalAirflow2D,
  type PetalAirflow2D,
  type PetalWakeSource2D,
} from "../domain/petal-airflow";
import type { EmitterTip } from "./emitter-tip";
import { emitterId } from "./emitter-tip";

/**
 * A single live petal. Lightweight state integrated each frame.
 *
 * Airstream model: a petal is born carrying a fraction (`carry`) of the prop
 * tip's instantaneous velocity, so it launches along the prop's actual arc.
 * That inherited motion bleeds off over time (rate set by `streakLength`)
 * while vertical velocity eases toward a terminal fall. Nearby petals sample
 * one shared air field, with a small private flutter that keeps their faces
 * from locking together.
 */
interface Petal {
  /** Current position (px). */
  x: number;
  y: number;
  /** Horizontal velocity (px/s). Inherited at birth, decays toward flutter. */
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
  /** Per-petal flutter frequency (rad/s), used only for fine variation. */
  freq: number;
  /** Per-petal flutter phase offset. */
  phase: number;
  /** Independent edge-on flutter rate and phase. */
  faceFreq: number;
  facePhase: number;
  /** Shape-level alpha ceiling; ambient petals are deliberately quieter. */
  opacity: number;
  /** True if this petal carries a short-lived ember rim. */
  ember: boolean;
}

const MAX_PETALS = 2048;
const FADE_OUT_FRACTION = 0.2; // last 20% of life fades alpha out
const FADE_IN_DURATION = 0.12; // seconds
const EMBER_MAX_AGE = 1.35; // seconds - readable heat trace, still shorter than the ash body
const TAU = Math.PI * 2;

/**
 * Canvas2D petals renderer. Silhouettes are drawn procedurally, then carried
 * through the same coherent air model as the 3D pool.
 *
 * Ember rim (ash palette only): particles flagged at spawn get a short
 * orange additive glow along their silhouette edge that cools while the
 * petal continues its normal lifetime.
 */
export class Petals2DRenderer {
  private petals: Petal[] = [];
  private lastTipPos = new Map<string, { x: number; y: number }>();
  private smoothedVelocity = new Map<string, { vx: number; vy: number }>();
  private readonly wakeSources: PetalWakeSource2D[] = [];
  private readonly airflow: PetalAirflow2D = { x: 0, y: 0, turn: 0 };
  private clock = 0;

  render(
    ctx: CanvasRenderingContext2D,
    params: Petals2DParams,
    emitters: EmitterTip[],
    dt: number,
    scale: number = 1
  ): void {
    this.clock += dt;
    const palette = params.resolvedPalette;
    const baseSize = params.baseSize * scale;
    const poolCap = Math.min(MAX_PETALS, params.poolSize ?? MAX_PETALS);

    // 1. Per-emitter velocity smoothing + spawn. Covers base props and every
    //    tunnel kaleidoscope layer (propIndex >= 2).
    const seen = new Set<string>();
    this.wakeSources.length = 0;
    for (const e of emitters) {
      if (!this.isEndEnabled(e.end, params)) continue;
      const id = emitterId(e.propIndex, e.tipIndex);
      seen.add(id);
      const last = this.lastTipPos.get(id);
      let vx = 0;
      let vy = 0;
      if (last && dt > 0) {
        vx = (e.x - last.x) / dt;
        vy = (e.y - last.y) / dt;
      }
      const prev = this.smoothedVelocity.get(id);
      const alpha = 1 - Math.pow(0.6, dt * 60);
      const svx = prev ? prev.vx + (vx - prev.vx) * alpha : vx;
      const svy = prev ? prev.vy + (vy - prev.vy) * alpha : vy;
      if (prev) {
        prev.vx = svx;
        prev.vy = svy;
      } else {
        this.smoothedVelocity.set(id, { vx: svx, vy: svy });
      }
      this.wakeSources.push({
        x: e.x,
        y: e.y,
        velocityX: svx,
        velocityY: svy,
      });
      const speedPx = Math.hypot(svx, svy);
      this.spawnPetals(
        params,
        palette,
        e,
        svx,
        svy,
        speedPx,
        dt,
        scale,
        baseSize,
        poolCap
      );
      if (last) {
        last.x = e.x;
        last.y = e.y;
      } else {
        this.lastTipPos.set(id, { x: e.x, y: e.y });
      }
    }
    // Prune state for emitters not present this frame (a layer toggled off or a
    // tip turned off by tracking-mode) so the Maps don't grow unbounded.
    for (const id of this.lastTipPos.keys())
      if (!seen.has(id)) this.lastTipPos.delete(id);
    for (const id of this.smoothedVelocity.keys())
      if (!seen.has(id)) this.smoothedVelocity.delete(id);

    // 2. Integrate + age + cull.
    this.integratePetals(dt, params, scale);

    if (this.petals.length === 0) return;

    // 3. Draw.
    this.drawPetals(ctx, palette);
  }

  private spawnPetals(
    params: Petals2DParams,
    palette: PetalPalette,
    tip: { x: number; y: number },
    svx: number,
    svy: number,
    speedPx: number,
    dt: number,
    scale: number,
    baseSize: number,
    poolCap: number
  ): void {
    if (this.petals.length >= poolCap) return;
    const PX_PER_WORLD = 60;
    const refSpeed = params.motionReferenceSpeed * PX_PER_WORLD * scale;
    const speedScalar = refSpeed > 0 ? Math.min(1, speedPx / refSpeed) : 0;
    const phrase = resolvePetalAirflowPhrase(this.clock);
    const ambient = params.ambientEmission * params.ambientSpawnRate * phrase;
    const motion =
      params.motionEmission *
      speedScalar *
      params.motionSpawnRate *
      (0.92 + phrase * 0.08);
    const ambientShare =
      ambient + motion > 0 ? ambient / (ambient + motion) : 1;
    const expected = (ambient + motion) * dt;
    let n = Math.floor(expected);
    if (Math.random() < expected - n) n++;
    const slots = poolCap - this.petals.length;
    if (n > slots) n = slots;
    if (n <= 0) return;

    const carry = params.carry;
    // Airstream needs enough hang time to draw the prop's recent path. Size,
    // opacity and motion drag keep that ribbon airy rather than cloud-like.
    const lifeBase = 2.2 + params.intensity * 1.2;

    for (let i = 0; i < n; i++) {
      const isAmbient = Math.random() < ambientShare;
      const shape = pickPetalSprite(palette);
      const size = resolvePetalSize(baseSize, params.intensity, shape);
      const ox = (Math.random() - 0.5) * 8 * scale;
      const oy = (Math.random() - 0.5) * 6 * scale;
      // Airstream: inherit a fraction of the tip's velocity so the petal
      // launches along the prop's actual arc. A little spread keeps the
      // stream from collapsing into one line.
      const spread = (Math.random() - 0.5) * 40 * scale;
      this.petals.push({
        x: tip.x + ox,
        y: tip.y + oy,
        vx: svx * carry + spread,
        vy: svy * carry + (10 + Math.random() * 20) * scale,
        age: 0,
        maxAge: lifeBase * (0.8 + Math.random() * 0.4),
        size,
        shape,
        tint: pickPetalTint(palette),
        rot: Math.random() * TAU,
        freq: 1.1 + Math.random() * 2.2,
        phase: Math.random() * TAU,
        faceFreq: 1.5 + Math.random() * 2.1,
        facePhase: Math.random() * TAU,
        opacity: resolvePetalOpacity(shape, isAmbient),
        ember: rollEmberFlag(palette),
      });
    }
  }

  private integratePetals(
    dt: number,
    params: Petals2DParams,
    scale: number
  ): void {
    // Inherited horizontal motion bleeds off — higher streakLength keeps the
    // decay base closer to 1 so the ribbon lingers longer behind the prop.
    const decayBase = 0.02 + params.streakLength * 0.5;
    const drag = Math.pow(decayBase, dt);
    const fall = params.fallBaseSpeed * (0.3 + 0.7 * params.fallSpeed);
    const fallEase = 1 - Math.pow(0.25, dt);
    let writeIdx = 0;
    for (let i = 0; i < this.petals.length; i++) {
      const p = this.petals[i]!;
      p.age += dt;
      if (p.age >= p.maxAge) continue;
      // Horizontal inherited motion decays; vertical eases toward terminal fall.
      p.vx *= drag;
      p.vy += (fall - p.vy) * fallEase;
      const airflow = samplePetalAirflow2D(
        p.x,
        p.y,
        this.clock,
        scale,
        this.airflow
      );
      for (const source of this.wakeSources) {
        addPetalWake2D(airflow, p.x, p.y, source, scale);
      }
      const privateFlutter =
        Math.sin(this.clock * p.freq + p.phase) *
        3.4 *
        scale *
        (0.55 + params.swayAmplitude * 0.45);
      const horizontalMotion = p.vx + airflow.x + privateFlutter;
      p.x += horizontalMotion * dt;
      p.y += (p.vy + airflow.y) * dt;
      // Rotation follows the current instead of revealing its old sine wave.
      p.rot +=
        (horizontalMotion * 0.012 +
          airflow.turn * 0.82 +
          privateFlutter * 0.008) *
        dt;
      if (i !== writeIdx) this.petals[writeIdx] = p;
      writeIdx++;
    }
    this.petals.length = writeIdx;
  }

  private drawPetals(
    ctx: CanvasRenderingContext2D,
    palette: PetalPalette
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
          lifeT > 1 - FADE_OUT_FRACTION ? (1 - lifeT) / FADE_OUT_FRACTION : 1;
        const face =
          0.32 +
          Math.abs(Math.sin(this.clock * p.faceFreq + p.facePhase)) * 0.68;
        const alpha = Math.max(0, fadeIn * fadeOut * p.opacity);
        if (alpha <= 0.02) continue;

        const cos = Math.cos(p.rot);
        const sin = Math.sin(p.rot);
        ctx.setTransform(cos * face, sin * face, -sin, cos, p.x, p.y);
        ctx.globalAlpha = alpha;
        drawPetalSilhouette(ctx, p.shape, p.size, p.tint);
        if (p.ember && palette.emberEdge && p.age < EMBER_MAX_AGE) {
          const emberT = p.age / EMBER_MAX_AGE;
          const emberAlpha = (1 - emberT) * alpha * 1.15;
          if (emberAlpha > 0.02) {
            drawPetalEmberRim(
              ctx,
              p.shape,
              p.size,
              palette.emberEdge.color,
              emberAlpha
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

  private isEndEnabled(end: "A" | "B", params: Petals2DParams): boolean {
    if (params.trackingMode === "both_ends") return true;
    return params.trackingMode === "left_end" ? end === "A" : end === "B";
  }

  dispose(): void {
    this.petals = [];
    this.lastTipPos.clear();
    this.smoothedVelocity.clear();
    this.wakeSources.length = 0;
    this.clock = 0;
  }
}
