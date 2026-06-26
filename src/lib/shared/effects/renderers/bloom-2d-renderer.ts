import type { Bloom2DParams } from "../translators/canvas2d-types";

/**
 * Per-tip input for the bloom overlay. Each tip is an independent light
 * source so palette/color-mode indexing reads naturally off `tipIndex`.
 *
 * `propIndex`: base blue=0, red=1; tunnel layer li blue=2+2*li, red=3+2*li.
 * `tipIndex`: global tip index - used for palette cycling AND as the key for
 * per-tip velocity tracking (frame-to-frame delta).
 * `color`: the tip's resolved prop color (base trail color or tunnel spectrum),
 * consumed when `params.colorMode === "prop-matched"`. Resolved upstream so a
 * tunnel copy blooms in the same hue it renders as, not a hardcoded red.
 */
export interface BloomTipInput {
  x: number;
  y: number;
  propIndex: number;
  tipIndex: number;
  color: string;
}

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/**
 * Lens-bloom renderer for the Canvas2D backend.
 *
 * Renders each prop tip as an over-bright moving light source the way a camera
 * lens responds to one - the optics of brightness, not just a glow. Five layers
 * per tip, all additive:
 *   1. Colored halo (falloff-shaped radial gradient).
 *   2. Blown-out white-hot core (over-exposure).
 *   3. Anamorphic streak - the halo stretched along the motion vector; length
 *      grows with the tip's per-frame speed.
 *   4. Diffraction star spikes - the lens glint off a bright point.
 *   5. Chromatic fringe - red/blue ghosts split along motion on fast swings.
 *
 * A long-exposure afterglow is achieved with an offscreen accumulation buffer:
 * light is drawn into it each frame, the buffer decays by a fixed per-frame
 * fraction (frame-based, NOT wall-clock - so QR export stays deterministic),
 * and the buffer is composited onto the overlay. When no offscreen canvas is
 * available (headless/jsdom) it falls back to drawing straight to the context -
 * same lens bloom, minus the persistent trail.
 *
 * This is the only effect named after a real photographic phenomenon, and it
 * now renders that phenomenon: lens bloom.
 */

/**
 * Perceptual response curve for the Intensity slider.
 *
 * The five lens layers are all drawn with additive `lighter` blend, so light
 * saturates toward white around ~0.15-0.2 alpha. Feeding the raw 0..1 slider
 * value straight in as alpha makes the bottom ~15% of the track do all the
 * useful work and everything above it blow out flat white - the slider is
 * linear in alpha but wildly nonlinear in *perceived* brightness.
 *
 * Gamma-shaping the slider value (like a camera exposure curve) makes the
 * track perceptually linear: medium brightness lands near the 50% mark, "barely
 * glowing" occupies the low end, and full blowout stays reachable at 100%.
 * 0.5 ** 2.6 ≈ 0.16, i.e. the slider's midpoint renders at ~16% alpha.
 */
const INTENSITY_GAMMA = 2.6;

export class Bloom2DRenderer {
  // Offscreen accumulation buffer holding the decaying long-exposure light.
  private accum: OffscreenCanvas | HTMLCanvasElement | null = null;
  private accumCtx: Ctx2D | null = null;
  private accumW = 0;
  private accumH = 0;
  // Whether offscreen allocation has been attempted and failed (headless) -
  // avoids retrying createElement every frame in environments without canvas.
  private accumUnavailable = false;

  // Previous tip positions by tipIndex → per-frame velocity for streak length,
  // spike flare, and chromatic offset.
  private prevPos = new Map<number, { x: number; y: number }>();

  render(
    ctx: CanvasRenderingContext2D,
    params: Bloom2DParams,
    tips: BloomTipInput[],
    scale: number = 1,
  ): void {
    if (tips.length === 0) {
      // Still decay the afterglow so a lifted prop's light fades out instead of
      // freezing mid-trail.
      this.decayOnly(ctx, params);
      return;
    }

    const canvas = ctx.canvas as HTMLCanvasElement | undefined;
    const W = canvas?.width ?? 0;
    const H = canvas?.height ?? 0;

    const accCtx = W > 0 && H > 0 ? this.ensureAccum(W, H) : null;

    if (!accCtx || !this.accum) {
      // No offscreen buffer (headless/jsdom): draw lens bloom directly, no
      // persistent afterglow. Behavior-equivalent minus the trail.
      this.drawContributions(ctx, params, tips, scale);
      this.rememberPositions(tips);
      return;
    }

    // 1. Decay the accumulation buffer toward transparent. afterglow→0 wipes it
    //    fully each frame (no trail); afterglow→1 keeps ~98% per frame (~1s).
    this.applyDecay(accCtx, params.afterglow, W, H);

    // 2. Add this frame's light into the buffer (additive).
    this.drawContributions(accCtx, params, tips, scale);

    // 3. Composite the accumulated light onto the (already-cleared) overlay.
    ctx.save();
    ctx.globalCompositeOperation = params.blendMode ?? "lighter";
    ctx.globalAlpha = 1;
    ctx.drawImage(this.accum, 0, 0);
    ctx.restore();

    this.rememberPositions(tips);
  }

  dispose(): void {
    this.prevPos.clear();
    this.accum = null;
    this.accumCtx = null;
    this.accumW = 0;
    this.accumH = 0;
    this.accumUnavailable = false;
  }

  // ── Accumulation buffer ─────────────────────────────────────────────

  /** Decay-only frame (no tips): fade the afterglow, blit, no new light. */
  private decayOnly(ctx: CanvasRenderingContext2D, params: Bloom2DParams): void {
    if (!this.accum || !this.accumCtx) return;
    this.applyDecay(this.accumCtx, params.afterglow, this.accumW, this.accumH);
    ctx.save();
    ctx.globalCompositeOperation = params.blendMode ?? "lighter";
    ctx.globalAlpha = 1;
    ctx.drawImage(this.accum, 0, 0);
    ctx.restore();
  }

  /**
   * Reduce the alpha of everything already in the buffer by a fixed per-frame
   * fraction. `destination-out` with a low-alpha black fill subtracts alpha
   * uniformly - the standard light-trail decay. Frame-based (deterministic).
   */
  private applyDecay(acc: Ctx2D, afterglow: number, w: number, h: number): void {
    const retain = 0.6 + 0.39 * clamp01(afterglow); // 0.60..0.99 kept per frame
    acc.save();
    acc.globalCompositeOperation = "destination-out";
    acc.globalAlpha = 1;
    acc.fillStyle = `rgba(0,0,0,${1 - retain})`;
    acc.fillRect(0, 0, w, h);
    acc.restore();
  }

  private ensureAccum(W: number, H: number): Ctx2D | null {
    if (this.accumCtx && this.accumW === W && this.accumH === H) return this.accumCtx;
    if (this.accumUnavailable) return null;

    let canvas: OffscreenCanvas | HTMLCanvasElement | null = null;
    try {
      if (typeof OffscreenCanvas !== "undefined") {
        canvas = new OffscreenCanvas(W, H);
      } else if (typeof document !== "undefined") {
        const el = document.createElement("canvas");
        el.width = W;
        el.height = H;
        canvas = el;
      }
    } catch {
      canvas = null;
    }

    const c2d = (canvas?.getContext("2d") ?? null) as Ctx2D | null;
    if (!canvas || !c2d) {
      this.accum = null;
      this.accumCtx = null;
      this.accumUnavailable = true;
      return null;
    }

    this.accum = canvas;
    this.accumCtx = c2d;
    this.accumW = W;
    this.accumH = H;
    return c2d;
  }

  // ── Per-tip light contributions ─────────────────────────────────────

  /** Draw every tip's five lens layers into `target` with additive blend. */
  private drawContributions(
    target: Ctx2D,
    params: Bloom2DParams,
    tips: BloomTipInput[],
    scale: number,
  ): void {
    const t = performance.now() / 1000;
    const pulseFactor =
      1 -
      params.pulse +
      params.pulse * (0.5 + 0.5 * Math.sin(t * params.pulseRate * Math.PI * 2));
    const shaped = Math.pow(clamp01(params.intensity), INTENSITY_GAMMA);
    const baseAlpha = clamp01(shaped * pulseFactor);
    if (baseAlpha <= 0 && params.falloff !== "ring") return;

    const coreR = Math.max(1, params.radius * scale);

    target.save();
    target.globalCompositeOperation = "lighter";
    target.globalAlpha = 1;

    for (const tip of tips) {
      const color = this.pickColor(params, tip, t);

      // Per-frame velocity drives the motion-reactive layers.
      const prev = this.prevPos.get(tip.tipIndex);
      const vx = prev ? tip.x - prev.x : 0;
      const vy = prev ? tip.y - prev.y : 0;
      const speed = Math.hypot(vx, vy);
      const angle = speed > 0.01 ? Math.atan2(vy, vx) : 0;

      // 1. Colored halo.
      this.drawHalo(target, tip.x, tip.y, coreR, params.falloff, color, baseAlpha);

      // 2. Over-exposed white-hot core.
      this.drawCore(target, tip.x, tip.y, coreR * 0.38, baseAlpha);

      // 3. Anamorphic motion streak.
      if (params.streak > 0 && speed > 0.5) {
        this.drawStreak(target, tip.x, tip.y, coreR, angle, speed, params.streak, color, baseAlpha);
      }

      // 4. Diffraction star spikes.
      if (params.spikes > 0) {
        this.drawSpikes(target, tip.x, tip.y, coreR, scale, speed, params.spikes, baseAlpha);
      }

      // 5. Chromatic fringe on fast swings.
      if (params.chromatic > 0 && speed > 0.5) {
        this.drawChroma(target, tip.x, tip.y, coreR, angle, speed, params.chromatic, baseAlpha);
      }
    }

    target.restore();
  }

  private drawHalo(
    target: Ctx2D,
    x: number,
    y: number,
    r: number,
    falloff: Bloom2DParams["falloff"],
    color: string,
    alpha: number,
  ): void {
    const g = target.createRadialGradient(x, y, 0, x, y, r);
    const col = (a: number) => withAlpha(color, alpha * a);
    const transparent = withAlpha(color, 0);
    switch (falloff) {
      case "sharp":
        g.addColorStop(0, col(1));
        g.addColorStop(0.15, col(0.7));
        g.addColorStop(0.6, col(0.1));
        g.addColorStop(1, transparent);
        break;
      case "ring":
        g.addColorStop(0, transparent);
        g.addColorStop(0.45, col(0.2));
        g.addColorStop(0.7, col(1));
        g.addColorStop(0.9, col(0.3));
        g.addColorStop(1, transparent);
        break;
      case "smooth":
      default:
        g.addColorStop(0, col(1));
        g.addColorStop(0.4, col(0.5));
        g.addColorStop(1, transparent);
        break;
    }
    target.fillStyle = g;
    target.fillRect(x - r, y - r, r * 2, r * 2);
  }

  /** Blown-out near-white center - the over-exposed light source. */
  private drawCore(target: Ctx2D, x: number, y: number, r: number, alpha: number): void {
    const g = target.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${clamp01(alpha)})`);
    g.addColorStop(0.5, `rgba(255,255,255,${clamp01(alpha * 0.5)})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    target.fillStyle = g;
    target.fillRect(x - r, y - r, r * 2, r * 2);
  }

  /**
   * Stretch the halo into an ellipse along the motion vector. Stretch grows
   * with speed (capped) so a fast swing reads as a long light smear, a slow
   * drift as a near-circle.
   */
  private drawStreak(
    target: Ctx2D,
    x: number,
    y: number,
    coreR: number,
    angle: number,
    speed: number,
    streak: number,
    color: string,
    alpha: number,
  ): void {
    const stretch = 1 + Math.min(speed / coreR, 3.5) * streak * 1.6;
    target.save();
    target.translate(x, y);
    target.rotate(angle);
    target.scale(stretch, 1);
    const g = target.createRadialGradient(0, 0, 0, 0, 0, coreR);
    g.addColorStop(0, withAlpha(color, alpha * 0.55));
    g.addColorStop(0.5, withAlpha(color, alpha * 0.22));
    g.addColorStop(1, withAlpha(color, 0));
    target.fillStyle = g;
    target.fillRect(-coreR, -coreR, coreR * 2, coreR * 2);
    target.restore();
  }

  /**
   * 4 cardinal + 4 shorter diagonal bright lines radiating from the tip - the
   * star glint a lens throws off a bright point. Flares slightly with speed.
   */
  private drawSpikes(
    target: Ctx2D,
    x: number,
    y: number,
    coreR: number,
    scale: number,
    speed: number,
    spikes: number,
    alpha: number,
  ): void {
    const flare = 1 + Math.min(speed / coreR, 2) * 0.5;
    const longLen = coreR * (1.2 + 2.2 * spikes) * flare;
    const a = clamp01(alpha * spikes * 0.9);
    if (a <= 0) return;

    target.save();
    target.translate(x, y);
    target.lineCap = "round";
    for (let i = 0; i < 8; i++) {
      const ang = (i * Math.PI) / 4;
      const len = i % 2 === 0 ? longLen : longLen * 0.45; // cardinals long, diagonals short
      const ex = Math.cos(ang) * len;
      const ey = Math.sin(ang) * len;
      const g = target.createLinearGradient(0, 0, ex, ey);
      g.addColorStop(0, `rgba(255,255,255,${a})`);
      g.addColorStop(0.25, `rgba(255,255,255,${a * 0.5})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      target.strokeStyle = g;
      target.lineWidth = Math.max(1, (i % 2 === 0 ? 1.6 : 1.0) * scale);
      target.beginPath();
      target.moveTo(0, 0);
      target.lineTo(ex, ey);
      target.stroke();
    }
    target.restore();
  }

  /**
   * Red/blue ghost cores offset along the motion axis - the lens can't focus
   * all wavelengths together on a fast-moving bright source.
   */
  private drawChroma(
    target: Ctx2D,
    x: number,
    y: number,
    coreR: number,
    angle: number,
    speed: number,
    chromatic: number,
    alpha: number,
  ): void {
    const offset = Math.min(speed * 0.5, coreR * 0.6) * chromatic;
    if (offset < 0.5) return;
    const ox = Math.cos(angle) * offset;
    const oy = Math.sin(angle) * offset;
    const r = coreR * 0.5;
    const a = clamp01(alpha * 0.5);
    this.drawTintedBlob(target, x + ox, y + oy, r, `rgba(255,40,40,${a})`);
    this.drawTintedBlob(target, x - ox, y - oy, r, `rgba(40,80,255,${a})`);
  }

  private drawTintedBlob(target: Ctx2D, x: number, y: number, r: number, head: string): void {
    const g = target.createRadialGradient(x, y, 0, x, y, r);
    const tail = head.replace(/[\d.]+\)$/, "0)");
    g.addColorStop(0, head);
    g.addColorStop(1, tail);
    target.fillStyle = g;
    target.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private pickColor(params: Bloom2DParams, tip: BloomTipInput, t: number): string {
    switch (params.colorMode) {
      case "prop-matched":
        return tip.color;
      case "rainbow":
        return `hsl(${(t * 60) % 360}, 80%, 60%)`;
      case "palette": {
        if (params.palette.length === 0) return params.color;
        return params.palette[tip.tipIndex % params.palette.length]!;
      }
      case "solid":
      default:
        return params.color;
    }
  }

  private rememberPositions(tips: BloomTipInput[]): void {
    for (const tip of tips) {
      this.prevPos.set(tip.tipIndex, { x: tip.x, y: tip.y });
    }
    if (this.prevPos.size > tips.length) {
      const live = new Set(tips.map((tp) => tp.tipIndex));
      for (const key of this.prevPos.keys()) {
        if (!live.has(key)) this.prevPos.delete(key);
      }
    }
  }
}

/** Clamp to [0, 1]. */
function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Blend an incoming color with a target alpha. Handles `#rgb`, `#rrggbb`,
 * and `hsl(...)` forms - everything `pickColor` produces.
 */
function withAlpha(color: string, alpha: number): string {
  const a = clamp01(alpha);
  if (color.startsWith("#")) {
    const { r, g, b } = hexToRgb(color);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  if (color.startsWith("hsl(") && !color.startsWith("hsla(")) {
    return `hsla${color.slice(3, -1)}, ${a})`;
  }
  if (color.startsWith("rgb(") && !color.startsWith("rgba(")) {
    return `rgba${color.slice(3, -1)}, ${a})`;
  }
  return color;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace("#", "");
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const num = parseInt(h, 16);
  return {
    r: (num >> 16) & 0xff,
    g: (num >> 8) & 0xff,
    b: num & 0xff,
  };
}
