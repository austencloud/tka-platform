import type { Bloom2DParams } from "../translators/canvas2d-types";
import {
  resolveBloomAfterglowRetention,
  resolveBloomExposure,
  resolveBloomFootprintScale,
  resolveBloomHistoryDeposit,
} from "../domain/bloom-optics";

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
  /** Tracker velocity in viewbox units per second when available. */
  velocityX?: number;
  /** Tracker velocity in viewbox units per second when available. */
  velocityY?: number;
}

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const PRISM_SPECTRUM = [
  "255,42,52",
  "255,132,24",
  "255,224,60",
  "62,238,120",
  "34,196,255",
  "92,72,255",
] as const;

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
 *   5. Spectral trail - moving white light separates into a narrow spectrum.
 *
 * A long-exposure afterglow is achieved with an offscreen accumulation buffer.
 * Only moving colored scatter enters that buffer. The white source, spikes,
 * and spectral fringe stay live, so revisiting a pose cannot stack them into a
 * flash. The decay remains frame-based so QR export stays deterministic.
 *
 * This is the only effect named after a real photographic phenomenon, and it
 * now renders that phenomenon: lens bloom.
 */

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
  // spike flare, and prism motion response.
  private prevPos = new Map<number, { x: number; y: number }>();

  render(
    ctx: CanvasRenderingContext2D,
    params: Bloom2DParams,
    tips: BloomTipInput[],
    scale: number = 1
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
      this.drawLiveContributions(ctx, params, tips, scale);
      this.rememberPositions(tips);
      return;
    }

    // 1. Decay the accumulated colored scatter.
    this.applyDecay(accCtx, params.afterglow, W, H);

    // 2. Add a bounded dose of moving halo and streak. The hot source never
    //    enters this buffer.
    this.drawHistoryContributions(accCtx, params, tips, scale);

    // 3. Composite history behind the live optics.
    ctx.save();
    ctx.globalCompositeOperation = params.blendMode ?? "lighter";
    ctx.globalAlpha = 1;
    ctx.drawImage(this.accum, 0, 0);
    ctx.restore();

    // 4. Draw the source exactly once. This is what keeps slow turns and
    //    crossings from flashing white.
    this.drawLiveContributions(ctx, params, tips, scale);

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
  private decayOnly(
    ctx: CanvasRenderingContext2D,
    params: Bloom2DParams
  ): void {
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
  private applyDecay(
    acc: Ctx2D,
    afterglow: number,
    w: number,
    h: number
  ): void {
    const retain = resolveBloomAfterglowRetention(afterglow);
    acc.save();
    acc.globalCompositeOperation = "destination-out";
    acc.globalAlpha = 1;
    acc.fillStyle = `rgba(0,0,0,${1 - retain})`;
    acc.fillRect(0, 0, w, h);
    acc.restore();
  }

  private ensureAccum(W: number, H: number): Ctx2D | null {
    if (this.accumCtx && this.accumW === W && this.accumH === H)
      return this.accumCtx;
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

  /** Draw every tip's live lens layers once. */
  private drawLiveContributions(
    target: Ctx2D,
    params: Bloom2DParams,
    tips: BloomTipInput[],
    scale: number
  ): void {
    const t = performance.now() / 1000;
    const baseAlpha = resolveBloomExposure(
      params.intensity,
      params.pulse,
      params.pulseRate,
      t
    );
    if (baseAlpha <= 0) return;

    const coreR = Math.max(1, params.radius * scale);
    const footprintScale = resolveBloomFootprintScale(
      new Set(tips.map((tip) => tip.propIndex)).size
    );

    target.save();
    target.globalCompositeOperation = "lighter";
    target.globalAlpha = 1;

    for (const tip of tips) {
      const color = this.pickColor(params, tip, t);

      // Per-frame velocity drives the motion-reactive layers.
      const prev = this.prevPos.get(tip.tipIndex);
      const vx =
        tip.velocityX !== undefined
          ? tip.velocityX / 60
          : prev
            ? tip.x - prev.x
            : 0;
      const vy =
        tip.velocityY !== undefined
          ? tip.velocityY / 60
          : prev
            ? tip.y - prev.y
            : 0;
      const speed = Math.hypot(vx, vy);
      const angle = speed > 0.01 ? Math.atan2(vy, vx) : 0;

      // 1. Colored halo.
      this.drawHalo(
        target,
        tip.x,
        tip.y,
        coreR,
        params.falloff,
        color,
        baseAlpha * (1 - params.chromatic * 0.75)
      );

      // 2. Anamorphic motion streak.
      if (params.streak > 0 && speed > 0.5) {
        this.drawStreak(
          target,
          tip.x,
          tip.y,
          coreR,
          angle,
          speed,
          params.streak,
          color,
          baseAlpha
        );
      }

      // 3. Prism reveals the direction of travel. A paused tip stays clean
      //    instead of spraying a decorative rainbow across the notation.
      if (params.chromatic > 0 && speed > 0.2) {
        this.drawSpectralTrail(
          target,
          tip.x,
          tip.y,
          coreR,
          vx,
          vy,
          speed,
          params.chromatic,
          footprintScale,
          baseAlpha
        );
      }

      // A high-dispersion preset keeps a hairline red/cyan edge at rest. It is
      // just enough to identify Prism on static arc samples without projecting
      // any geometry over the motion paths.
      if (params.chromatic >= 0.8) {
        this.drawSpectralEdge(
          target,
          tip.x,
          tip.y,
          coreR,
          params.chromatic,
          baseAlpha
        );
      }

      // 4. The white source sits over the trail so the current prop position
      // remains more legible than the color separation behind it.
      if (params.coreStrength > 0) {
        this.drawCore(
          target,
          tip.x,
          tip.y,
          coreR * (0.16 + params.coreStrength * 0.22),
          baseAlpha * params.coreStrength
        );
      }

      // 5. Diffraction star spikes.
      if (params.spikes > 0) {
        this.drawSpikes(
          target,
          tip.x,
          tip.y,
          coreR,
          scale,
          speed,
          params.spikes,
          baseAlpha
        );
      }
    }

    target.restore();
  }

  /**
   * Store only the moving colored scatter. Deposit is normalized against the
   * chosen retention, which keeps long afterglow from becoming white by
   * accumulation alone.
   */
  private drawHistoryContributions(
    target: Ctx2D,
    params: Bloom2DParams,
    tips: BloomTipInput[],
    scale: number
  ): void {
    const deposit = resolveBloomHistoryDeposit(params.afterglow);
    if (deposit <= 0) return;

    const t = performance.now() / 1000;
    const exposure = resolveBloomExposure(
      params.intensity,
      params.pulse,
      params.pulseRate,
      t
    );
    const alpha = exposure * deposit;
    if (alpha <= 0) return;

    const coreR = Math.max(1, params.radius * scale);
    target.save();
    target.globalCompositeOperation = "lighter";
    target.globalAlpha = 1;

    for (const tip of tips) {
      const prev = this.prevPos.get(tip.tipIndex);
      if (!prev) continue;
      const vx = tip.x - prev.x;
      const vy = tip.y - prev.y;
      const speed = Math.hypot(vx, vy);
      if (speed <= 0.5) continue;

      const color = this.pickColor(params, tip, t);
      const angle = Math.atan2(vy, vx);
      this.drawHalo(
        target,
        tip.x,
        tip.y,
        coreR * (0.62 + params.streak * 0.18),
        params.falloff,
        color,
        alpha
      );
      if (params.streak > 0) {
        this.drawStreak(
          target,
          tip.x,
          tip.y,
          coreR,
          angle,
          speed,
          params.streak,
          color,
          alpha
        );
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
    alpha: number
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
  private drawCore(
    target: Ctx2D,
    x: number,
    y: number,
    r: number,
    alpha: number
  ): void {
    const g = target.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${clamp01(alpha)})`);
    g.addColorStop(0.5, `rgba(255,255,255,${clamp01(alpha * 0.5)})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    target.fillStyle = g;
    target.fillRect(x - r, y - r, r * 2, r * 2);
  }

  /** A compact chromatic fringe that stays under the white source. */
  private drawSpectralEdge(
    target: Ctx2D,
    x: number,
    y: number,
    coreR: number,
    chromatic: number,
    alpha: number
  ): void {
    const offset = coreR * 0.22;
    const radius = coreR * 0.28;
    const edgeAlpha = clamp01(alpha * chromatic * 0.52);
    const edges = [
      { x: x - offset, rgb: "255,42,52" },
      { x: x + offset, rgb: "34,196,255" },
    ] as const;

    for (const edge of edges) {
      const gradient = target.createRadialGradient(
        edge.x,
        y,
        0,
        edge.x,
        y,
        radius
      );
      gradient.addColorStop(0, `rgba(${edge.rgb},${edgeAlpha})`);
      gradient.addColorStop(0.58, `rgba(${edge.rgb},${edgeAlpha * 0.44})`);
      gradient.addColorStop(1, `rgba(${edge.rgb},0)`);
      target.fillStyle = gradient;
      target.fillRect(edge.x - radius, y - radius, radius * 2, radius * 2);
    }
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
    alpha: number
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
    alpha: number
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

  /** A short red-to-violet exposure trailing the tip's actual movement. */
  private drawSpectralTrail(
    target: Ctx2D,
    x: number,
    y: number,
    coreR: number,
    velocityX: number,
    velocityY: number,
    speed: number,
    chromatic: number,
    footprintScale: number,
    alpha: number
  ): void {
    const threshold = Math.max(0.2, coreR * 0.008);
    if (speed <= threshold) return;

    const motion = clamp01((speed - threshold) / Math.max(1, coreR * 0.24));
    const length =
      coreR * footprintScale * (0.38 + motion * (0.8 + chromatic * 0.65));
    const spread = coreR * footprintScale * chromatic * (0.07 + motion * 0.08);
    const bandWidth = Math.max(
      0.65,
      coreR * footprintScale * (0.02 + motion * 0.012)
    );
    const bandCount = PRISM_SPECTRUM.length;
    const intensity = clamp01(alpha * chromatic * (0.72 + motion * 0.2));
    if (length < 1 || intensity <= 0) return;

    target.save();
    target.translate(x, y);
    target.rotate(Math.atan2(velocityY, velocityX));
    target.lineCap = "round";

    for (let index = 0; index < bandCount; index++) {
      const amount = bandCount === 1 ? 0.5 : index / (bandCount - 1);
      const offset = lerp(-spread, spread, amount);
      const rgb = PRISM_SPECTRUM[index]!;
      const gradient = target.createLinearGradient(0, 0, -length, 0);
      gradient.addColorStop(0, `rgba(${rgb},${intensity * 0.5})`);
      gradient.addColorStop(0.18, `rgba(${rgb},${intensity * 0.72})`);
      gradient.addColorStop(0.58, `rgba(${rgb},${intensity * 0.42})`);
      gradient.addColorStop(1, `rgba(${rgb},0)`);
      target.strokeStyle = gradient;
      target.lineWidth = bandWidth;
      target.beginPath();
      target.moveTo(-coreR * 0.03, offset * 0.15);
      target.lineTo(-length * 0.42, offset * 0.6);
      target.lineTo(-length, offset);
      target.stroke();
    }

    target.restore();
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private pickColor(
    params: Bloom2DParams,
    tip: BloomTipInput,
    t: number
  ): string {
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
    const live = new Set(tips.map((tip) => tip.tipIndex));
    for (const key of this.prevPos.keys()) {
      if (!live.has(key)) {
        this.prevPos.delete(key);
      }
    }
  }
}

/** Clamp to [0, 1]. */
function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
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
