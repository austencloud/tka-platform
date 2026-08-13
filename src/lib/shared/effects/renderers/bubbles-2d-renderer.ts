import type { Bubbles2DParams } from "../translators/canvas2d-types";
import type { BubblePalette } from "../domain/bubble-palettes";
import { oilIridescentRim } from "../domain/bubble-palettes";
import type { EmitterTip } from "./emitter-tip";
import { emitterId } from "./emitter-tip";

/**
 * A single live bubble. Lightweight state - position is integrated each
 * frame instead of closed-form like water droplets because bubbles pick
 * up a bit of horizontal drift and grow over lifetime.
 */
interface Bubble {
  /** Drift-free position (px). Wobble is added at draw time. */
  x: number;
  y: number;
  /** Horizontal drift velocity (px/s). Small natural chaos. */
  vx: number;
  /** Vertical velocity (px/s). Negative = rising (screen-up). */
  vy: number;
  /** Seconds since spawn. */
  age: number;
  /** Seconds until pop. */
  maxAge: number;
  /** Radius at spawn (px). Barely changes - see `currentRadius`. */
  baseR: number;
  /** Sideways sway amplitude (px) - bubbles weave as they rise. */
  wobbleAmp: number;
  /** Sway frequency (rad/s). */
  wobbleFreq: number;
  /** Sway phase offset so no two bubbles move in lockstep. */
  wobblePhase: number;
  /** 0-1 seed for where this bubble sits in the thin-film hue sweep. */
  filmPhase: number;
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
  /** Film sliver orientation and angular velocity. */
  angle: number;
  spin: number;
  /** Color cached at spawn - avoids per-frame palette lookup when iridescent. */
  color: string;
}

interface BubbleGradientSet {
  body: CanvasGradient;
  specular: CanvasGradient;
  bounce: CanvasGradient;
}

const MAX_BUBBLES = 1024;
const POP_DURATION = 0.18;
const POP_RELAX_SCALE = 1.18;
const BURST_COUNT_MIN = 4;
const BURST_COUNT_MAX = 7;
const BURST_LIFE_MIN = 0.18;
const BURST_LIFE_VAR = 0.22;
const GRADIENT_CACHE_ENTRIES_PER_CONTEXT = 8;
const TAU = Math.PI * 2;

/**
 * Total swell over a bubble's life. A real soap bubble in air holds its
 * volume until it bursts - it does not balloon. 8% is enough to read as
 * "under tension" without becoming the cartoon growth this replaced.
 */
const LIFETIME_SWELL = 0.08;
/** Smallest bubble in the field, as a fraction of the intensity-scaled base. */
const SIZE_FLOOR = 0.34;
/** How hard the size roll biases toward small. 1 = uniform, higher = smaller. */
const SIZE_BIAS = 2.0;
/** Global opacity ceiling - bubbles are chrome, never the subject. */
const MAX_OPACITY = 0.78;

/**
 * Canvas2D bubbles renderer - per-tip buoyant emitter.
 *
 * Each bubble is four layers: a Fresnel interior gradient (clear through
 * the middle, brightening to a band just inside the edge), a hairline rim,
 * a thin-film sheen arc, and two highlights - a tight specular upper-left
 * plus a soft bounce lower-right. Sizes follow a power law so the field is
 * mostly small bubbles with occasional large ones, rise speed scales with
 * radius for parallax, and each bubble sways on its own sine. Bubbles hold
 * their volume and pop on timeout.
 */
export class Bubbles2DRenderer {
  private bubbles: Bubble[] = [];
  private bursts: PopBurst[] = [];
  private lastTipPos = new Map<string, { x: number; y: number }>();
  private smoothedVelocity = new Map<string, { vx: number; vy: number }>();
  private gradientCache = new WeakMap<
    CanvasRenderingContext2D,
    Map<string, BubbleGradientSet>
  >();
  private burstCursor = 0;

  render(
    ctx: CanvasRenderingContext2D,
    params: Bubbles2DParams,
    emitters: EmitterTip[],
    dt: number,
    scale: number = 1
  ): void {
    const palette = params.resolvedPalette;
    const baseR = params.baseRadius * scale * (0.7 + 0.9 * params.intensity);
    const poolCap = Math.min(MAX_BUBBLES, params.poolSize ?? MAX_BUBBLES);
    if (this.bursts.length > poolCap) this.bursts.length = poolCap;

    // 1. Per-tip velocity smoothing + spawn.
    const seen = new Set<string>();
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
      const speedPx = Math.hypot(svx, svy);
      this.spawnBubbles(params, e, speedPx, dt, scale, baseR, poolCap);
      if (last) {
        last.x = e.x;
        last.y = e.y;
      } else {
        this.lastTipPos.set(id, { x: e.x, y: e.y });
      }
    }

    // Prune per-tip state for emitters that vanished this frame.
    for (const id of this.lastTipPos.keys())
      if (!seen.has(id)) this.lastTipPos.delete(id);
    for (const id of this.smoothedVelocity.keys())
      if (!seen.has(id)) this.smoothedVelocity.delete(id);

    // 2. Integrate + age + cull.
    this.integrateBubbles(dt, scale, params, poolCap);
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
    poolCap: number
  ): void {
    if (this.bubbles.length >= poolCap) return;
    const PX_PER_WORLD = 60;
    const refSpeed = params.motionReferenceSpeed * PX_PER_WORLD * scale;
    const speedScalar = refSpeed > 0 ? Math.min(1, speedPx / refSpeed) : 0;
    const ambient = params.ambientEmission * params.ambientSpawnRate;
    const motion = params.motionEmission * speedScalar * params.motionSpawnRate;
    const expected = (ambient + motion) * dt;
    let n = Math.floor(expected);
    if (Math.random() < expected - n) n++;
    const slots = poolCap - this.bubbles.length;
    if (n > slots) n = slots;
    if (n <= 0) return;

    // Lifetime scales with intensity. Champagne-style palettes fizz out
    // fast; soapy ones linger.
    const paletteId = params.resolvedPalette.id;
    const lifeMult =
      paletteId === "champagne" || paletteId === "acid" ? 0.55 : 1.0;
    const lifeBase = (1.0 + params.intensity * 2.0) * lifeMult;
    // Size spread widens with sizeJitter but the floor stays put, so
    // raising it adds big bubbles rather than inflating every bubble.
    const spread = 0.42 + params.sizeJitter * 1.55;

    for (let i = 0; i < n; i++) {
      // Power-law size roll. Real bubble fields are mostly small bubbles
      // with the occasional large one - a uniform roll reads as a field of
      // identical discs, which is what made this effect look cartoony.
      const roll = Math.pow(Math.random(), SIZE_BIAS);
      const sizeMul = SIZE_FLOOR + roll * spread;
      const r0 = baseR * sizeMul;
      // Small origin offset so stacked spawns don't overlap perfectly.
      const ox = (Math.random() - 0.5) * 4 * scale;
      const oy = (Math.random() - 0.5) * 4 * scale;
      const drift = (Math.random() - 0.5) * 22 * scale;
      // Terminal rise velocity grows with radius (buoyancy ∝ volume, drag
      // ∝ area), so the big ones lead and the small ones hang back. That
      // parallax is most of what sells a bubble field as depth.
      const upSpeed =
        (16 + params.buoyancy * 92) * scale * (0.55 + sizeMul * 0.75);
      this.bubbles.push({
        x: tip.x + ox,
        y: tip.y + oy,
        vx: drift,
        vy: -upSpeed,
        age: 0,
        maxAge: lifeBase * (0.7 + Math.random() * 0.6),
        baseR: r0,
        // Small bubbles get shoved around by their own wake more than big
        // ones, so sway amplitude falls off as radius rises.
        wobbleAmp: (1.6 + Math.random() * 2.6) * scale * (1.3 - sizeMul * 0.5),
        wobbleFreq: 1.4 + Math.random() * 1.9,
        wobblePhase: Math.random() * TAU,
        filmPhase: Math.random(),
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
    poolCap: number
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
      // Horizontal drift bleeds off - the bubble settles into a pure
      // buoyant rise plus its own sway.
      b.vx *= Math.pow(0.55, dt);
      if (b.age >= b.maxAge) {
        b.popping = 1;
        b.popAge = 0;
        b.popR = this.currentRadius(b);
        this.spawnBurst(b, params, scale, poolCap);
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
      const damping = Math.pow(0.94, dt * 60);
      p.vx *= damping;
      p.vy *= damping;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.angle += p.spin * dt;
      if (i !== writeIdx) this.bursts[writeIdx] = p;
      writeIdx++;
    }
    this.bursts.length = writeIdx;
  }

  private spawnBurst(
    b: Bubble,
    params: Bubbles2DParams,
    scale: number,
    capacity: number
  ): void {
    if (capacity <= 0) return;
    const count =
      BURST_COUNT_MIN +
      Math.floor(Math.random() * (BURST_COUNT_MAX - BURST_COUNT_MIN + 1));
    const palette = params.resolvedPalette;
    const staticColor = palette.popBurst;
    const isIridescent = palette.iridescent === true;
    const lifeT = Math.min(1, b.age / b.maxAge);
    const color = isIridescent ? oilIridescentRim(lifeT) : staticColor;
    // The film that bursts is the bubble's own - fragment spread and size
    // both follow its radius, so a small bubble makes a small pop.
    const sizeK = Math.min(2, b.popR / (6 * scale));
    const speed = (55 + Math.random() * 85) * (0.6 + sizeK * 0.7);
    const x = b.x + this.wobbleX(b);
    for (let i = 0; i < count; i++) {
      const theta = (i / count) * TAU + Math.random() * 0.4;
      const mag = speed * (0.6 + Math.random() * 0.8);
      const burst =
        this.bursts.length < capacity
          ? ({} as PopBurst)
          : this.bursts[this.burstCursor % capacity]!;
      burst.x = x;
      burst.y = b.y;
      burst.vx = Math.cos(theta) * mag * scale;
      burst.vy = Math.sin(theta) * mag * scale;
      burst.age = 0;
      burst.maxAge = BURST_LIFE_MIN + Math.random() * BURST_LIFE_VAR;
      burst.r = (0.6 + Math.random() * 0.7) * (0.5 + sizeK) * scale;
      burst.angle = theta;
      burst.spin = (Math.random() - 0.5) * 9;
      burst.color = color;
      if (this.bursts.length < capacity) this.bursts.push(burst);
      this.burstCursor = (this.burstCursor + 1) % capacity;
    }
  }

  /**
   * Current radius for an alive bubble. Nearly constant: a film bubble
   * holds its volume and only thins slightly as it climbs, so this is a
   * few percent of ease-in swell rather than the lifetime tripling it
   * replaced.
   */
  private currentRadius(b: Bubble): number {
    const lifeT = Math.min(1, b.age / b.maxAge);
    return b.baseR * (1 + LIFETIME_SWELL * lifeT * lifeT);
  }

  /** Sway offset - bubbles weave sideways instead of tracking straight up. */
  private wobbleX(b: Bubble): number {
    return Math.sin(b.age * b.wobbleFreq + b.wobblePhase) * b.wobbleAmp;
  }

  private drawBubbles(
    ctx: CanvasRenderingContext2D,
    params: Bubbles2DParams,
    palette: BubblePalette
  ): void {
    ctx.save();
    try {
      ctx.globalCompositeOperation = "source-over";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const iridescent = palette.iridescent === true;

      // Three unit-radius gradients, built once and re-used for every
      // bubble by scaling the CTM at paint time - zero per-particle
      // allocation.

      // Interior: transparent through the middle, brightening into a thin
      // band just inside the edge. That Fresnel falloff is what reads as a
      // curved film instead of a flat tinted disc, and it's the single
      // biggest reason the old flat fill looked like a sticker.
      const {
        body: bodyGrad,
        specular: specGrad,
        bounce: bounceGrad,
      } = this.getGradients(ctx, palette);

      for (const b of this.bubbles) {
        let r: number;
        let alpha: number;
        if (b.popping === 1) {
          const t = b.popAge / POP_DURATION;
          const relaxed = 1 - Math.pow(1 - t, 2);
          r = b.popR * (1 + (POP_RELAX_SCALE - 1) * relaxed);
          alpha = Math.pow(1 - t, 1.6);
        } else {
          r = this.currentRadius(b);
          const lifeT = Math.min(1, b.age / b.maxAge);
          const fadeIn = lifeT < 0.12 ? lifeT / 0.12 : 1;
          const fadeOut = lifeT > 0.8 ? 1 - (lifeT - 0.8) / 0.2 : 1;
          alpha = fadeIn * fadeOut;
        }
        alpha *= MAX_OPACITY;
        if (alpha <= 0.02 || r < 0.5) continue;

        const x = b.x + this.wobbleX(b);
        const y = b.y;
        const lifeT = Math.min(1, b.age / b.maxAge);
        const rim = iridescent ? oilIridescentRim(lifeT) : palette.rim;

        if (b.popping === 1) {
          const t = b.popAge / POP_DURATION;
          const rimWidth = Math.min(1.9, Math.max(0.65, r * 0.055)) * 1.45;
          ctx.globalAlpha = alpha;
          ctx.lineWidth = rimWidth;
          ctx.strokeStyle = rim;
          ctx.beginPath();
          ctx.ellipse(
            x,
            y,
            r * (1 + t * 0.12),
            r * Math.max(0.16, 1 - t * 0.84),
            0,
            0,
            TAU
          );
          ctx.stroke();
          continue;
        }

        // Interior film.
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(r, r);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.arc(0, 0, 1.0, 0, TAU);
        ctx.fill();
        ctx.restore();

        // Rim. Held to roughly a hairline regardless of radius - a rim
        // that scales with r turns every large bubble into a cartoon outline.
        const rimWidth = Math.min(1.9, Math.max(0.65, r * 0.055));
        ctx.globalAlpha = alpha;
        ctx.lineWidth = rimWidth;
        ctx.strokeStyle = rim;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.stroke();

        // Thin-film interference: a hue-shifted sheen on the shadowed arc,
        // opposite the specular. Every palette gets a whisper of it, the
        // oil palette wears it openly - it's the same physics either way.
        if (r > 2) {
          const sheenT = (b.filmPhase + lifeT * 0.35) % 1;
          ctx.globalAlpha = alpha * (iridescent ? 0.65 : 0.3);
          ctx.lineWidth = rimWidth * 1.5;
          ctx.strokeStyle = oilIridescentRim(sheenT);
          ctx.beginPath();
          ctx.arc(x, y, r * 0.92, TAU * 0.06, TAU * 0.42);
          ctx.stroke();
        }

        // Primary specular, upper left.
        const specR = r * 0.2;
        ctx.save();
        ctx.translate(x - r * 0.4, y - r * 0.44);
        ctx.scale(specR, specR);
        ctx.globalAlpha = alpha * 0.9;
        ctx.fillStyle = specGrad;
        ctx.beginPath();
        ctx.arc(0, 0, 1.0, 0, TAU);
        ctx.fill();
        ctx.restore();

        // Secondary bounce, lower right.
        if (r > 3) {
          const bounceR = r * 0.3;
          ctx.save();
          ctx.translate(x + r * 0.36, y + r * 0.42);
          ctx.scale(bounceR, bounceR);
          ctx.globalAlpha = alpha * 0.32;
          ctx.fillStyle = bounceGrad;
          ctx.beginPath();
          ctx.arc(0, 0, 1.0, 0, TAU);
          ctx.fill();
          ctx.restore();
        }
      }
    } finally {
      ctx.restore();
    }
  }

  private drawBursts(ctx: CanvasRenderingContext2D): void {
    if (this.bursts.length === 0) return;
    ctx.save();
    try {
      ctx.globalCompositeOperation = "lighter";
      for (const p of this.bursts) {
        const t = p.age / p.maxAge;
        const alpha = 1 - t;
        if (alpha <= 0.02) continue;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.r * 1.65, p.r * 0.34, p.angle, 0, TAU);
        ctx.fill();
      }
    } finally {
      ctx.restore();
    }
  }

  private getGradients(
    ctx: CanvasRenderingContext2D,
    palette: BubblePalette
  ): BubbleGradientSet {
    let contextCache = this.gradientCache.get(ctx);
    if (!contextCache) {
      contextCache = new Map();
      this.gradientCache.set(ctx, contextCache);
    }
    const transform = ctx.getTransform();
    const key = `${palette.fill}|${palette.highlight}|${transform.a},${transform.b},${transform.c},${transform.d},${transform.e},${transform.f}`;
    const cached = contextCache.get(key);
    if (cached) return cached;

    const body = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    body.addColorStop(0, withAlphaScale(palette.fill, 0));
    body.addColorStop(0.6, withAlphaScale(palette.fill, 0.1));
    body.addColorStop(0.9, withAlphaScale(palette.fill, 0.7));
    body.addColorStop(1, withAlphaScale(palette.fill, 0.18));
    const specular = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    specular.addColorStop(0, palette.highlight);
    specular.addColorStop(0.45, withAlphaScale(palette.highlight, 0.55));
    specular.addColorStop(1, withAlphaScale(palette.highlight, 0));
    const bounce = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    bounce.addColorStop(0, withAlphaScale(palette.highlight, 0.4));
    bounce.addColorStop(1, withAlphaScale(palette.highlight, 0));
    const gradients = { body, specular, bounce };
    if (contextCache.size >= GRADIENT_CACHE_ENTRIES_PER_CONTEXT) {
      const oldestKey = contextCache.keys().next().value;
      if (oldestKey !== undefined) contextCache.delete(oldestKey);
    }
    contextCache.set(key, gradients);
    return gradients;
  }

  private isEndEnabled(end: "A" | "B", params: Bubbles2DParams): boolean {
    if (params.trackingMode === "both_ends") return true;
    return params.trackingMode === "left_end" ? end === "A" : end === "B";
  }

  dispose(): void {
    this.bubbles = [];
    this.bursts = [];
    this.lastTipPos.clear();
    this.smoothedVelocity.clear();
    this.gradientCache = new WeakMap();
    this.burstCursor = 0;
  }
}

/**
 * Re-alpha a palette color by a MULTIPLIER of whatever alpha it already
 * carries. Palette `fill` slots arrive as `rgba(...)` and `rim`/`highlight`
 * as hex; both are handled, so gradient stops stay relative to the
 * palette's intended opacity instead of overriding it.
 */
function withAlphaScale(color: string, factor: number): string {
  const k = Math.max(0, Math.min(1, factor));
  const rgba = color.match(
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/i
  );
  if (rgba) {
    const a = rgba[4] === undefined ? 1 : parseFloat(rgba[4]);
    return `rgba(${rgba[1]},${rgba[2]},${rgba[3]},${(a * k).toFixed(4)})`;
  }
  const s = color.replace("#", "");
  const r = parseInt(s.slice(0, 2), 16);
  const g = parseInt(s.slice(2, 4), 16);
  const b = parseInt(s.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${k})`;
}
