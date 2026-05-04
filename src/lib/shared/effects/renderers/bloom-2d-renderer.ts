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

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace("#", "");
  if (h.length === 3) {
    h = h.split("").map((c) => c + c).join("");
  }
  const num = parseInt(h, 16);
  return {
    r: (num >> 16) & 0xff,
    g: (num >> 8) & 0xff,
    b: num & 0xff,
  };
}

function withAlpha(color: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  if (color.startsWith("#")) {
    const { r, g, b } = hexToRgb(color);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  if (color.startsWith("hsl(") && !color.startsWith("hsla(")) {
    return `hsla${color.slice(3, -1)}, ${a})`;
  }
  return color;
}

function pickColor(params: Bloom2DParams, tip: BloomTipInput, t: number): string {
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

function buildGradient(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  falloff: Bloom2DParams["falloff"],
  color: string,
  alpha: number,
): CanvasGradient {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
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
  return g;
}

export function renderBloom(
  ctx: CanvasRenderingContext2D,
  params: Bloom2DParams,
  tips: BloomTipInput[],
  scale: number = 1,
): void {
  if (tips.length === 0) return;

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
      const color = pickColor(params, tip, t);
      const r = Math.max(1, params.radius * scale);
      const gradient = buildGradient(ctx, tip.x, tip.y, r, params.falloff, color, baseAlpha);
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

/** Stateless renderer — no resources to release. Provided for API compatibility. */
export function disposeBloom(): void {
  // Stateless - no ring buffers or accumulators to reset.
}
