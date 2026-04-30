import type { Bloom2DParams } from "../translators/canvas2d-types";

/**
 * Per-tip input for the bloom overlay. Unlike echo (which packs both
 * staff ends per prop into one `EchoTipInput`), bloom treats every tip
 * as an independent halo source so palette/color-mode indexing reads
 * naturally off `tipIndex` (global 0-3 index).
 *
 * `propIndex`: 0 = blue prop, 1 = red prop.
 * `tipIndex`: global tip index 0..3 - used for palette cycling.
 * `blueColor` / `redColor` are consumed when `params.colorMode === "prop-matched"`.
 */
export interface BloomTipInput {
  x: number;
  y: number;
  propIndex: 0 | 1;
  tipIndex: number;
  blueColor: string;
  redColor: string;
}

/**
 * Per-tip radial halation renderer for the Canvas2D backend.
 *
 * Each active tip gets a soft additive radial gradient centered on its
 * screen position - a continuous field of light that reads as the prop
 * being present in the space. Falloff mode changes the gradient shape
 * (smooth / sharp hot core / hollow ring). Pulse modulates intensity
 * over time via a sine wave keyed to `performance.now()`.
 *
 * Rendering uses `globalCompositeOperation = "lighter"` so overlapping
 * halos brighten where tips cluster - the viewer sees the prop's
 * "presence" as a continuous light field rather than discrete points.
 */
export class Bloom2DRenderer {
  render(
    ctx: CanvasRenderingContext2D,
    params: Bloom2DParams,
    tips: BloomTipInput[],
    scale: number = 1,
  ): void {
    if (tips.length === 0) return;

    // Time in seconds. Independent of playback - halos breathe even when paused.
    const t = performance.now() / 1000;
    const pulseFactor =
      1 -
      params.pulse +
      params.pulse * (0.5 + 0.5 * Math.sin(t * params.pulseRate * Math.PI * 2));
    const baseAlpha = params.intensity * pulseFactor;
    if (baseAlpha <= 0 && params.falloff !== "ring") return;

    const prev = {
      composite: ctx.globalCompositeOperation,
      alpha: ctx.globalAlpha,
      fill: ctx.fillStyle,
    };

    try {
      ctx.save();
      ctx.globalCompositeOperation = params.blendMode ?? "lighter";
      ctx.globalAlpha = 1;

      for (const tip of tips) {
        const color = this.pickColor(params, tip, t);
        // radius is px at reference canvas size; scale converts to actual canvas px
        const r = Math.max(1, params.radius * scale);
        const gradient = this.buildGradient(
          ctx,
          tip.x,
          tip.y,
          r,
          params.falloff,
          color,
          baseAlpha,
        );
        ctx.fillStyle = gradient;
        ctx.fillRect(tip.x - r, tip.y - r, r * 2, r * 2);
      }
    } finally {
      ctx.restore();
      ctx.globalCompositeOperation = prev.composite;
      ctx.globalAlpha = prev.alpha;
      ctx.fillStyle = prev.fill;
    }
  }

  private pickColor(params: Bloom2DParams, tip: BloomTipInput, t: number): string {
    switch (params.colorMode) {
      case "prop-matched":
        return tip.propIndex === 0 ? tip.blueColor : tip.redColor;
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

  private buildGradient(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    falloff: Bloom2DParams["falloff"],
    color: string,
    alpha: number,
  ): CanvasGradient {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const col = (a: number) => this.withAlpha(color, alpha * a);
    const transparent = this.withAlpha(color, 0);
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
    return g;
  }

  /**
   * Blend an incoming color with a target alpha. Handles `#rgb`, `#rrggbb`,
   * and `hsl(...)` forms - everything the colorMode resolver produces.
   */
  private withAlpha(color: string, alpha: number): string {
    const a = Math.max(0, Math.min(1, alpha));
    if (color.startsWith("#")) {
      const { r, g, b } = hexToRgb(color);
      return `rgba(${r}, ${g}, ${b}, ${a})`;
    }
    if (color.startsWith("hsl(") && !color.startsWith("hsla(")) {
      // "hsl(H, S%, L%)" → "hsla(H, S%, L%, a)"
      return `hsla${color.slice(3, -1)}, ${a})`;
    }
    // Fallback - best-effort; upstream never produces other forms.
    return color;
  }

  dispose(): void {
    // Stateless - no ring buffers or accumulators to reset.
  }
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
