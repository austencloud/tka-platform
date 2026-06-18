/**
 * Petal palette registry.
 *
 * Silhouettes now draw in two rendering layers:
 *
 *   1. SVG-path-based (Path2D + DOMMatrix): UXWing autumn leaves, hand-
 *      authored tropical/ginkgo leaves. Fills with a radial gradient
 *      (bright centre → base tint → darker rim) plus a subtle darker
 *      stroke for definition. Matches the painted botanical look of the
 *      `@austencloud/backgrounds` autumn-drift + cherry-blossom systems.
 *   2. Procedural (canvas path ops): blossom 5-petal flower with glow +
 *      stamen centre, single blossom petal, and generic round/oval/elongated/
 *      stylized fallbacks for the custom palette.
 *
 * Path2D availability is probed once at module load. In test environments
 * (jsdom) that lack Path2D, SVG shapes fall back to their closest
 * procedural approximation. Production always takes the SVG path.
 *
 * Provenance note - the UXWing SVG path data and the cherry blossom
 * drawing kernel mirror constants that live in
 * `@austencloud/backgrounds` but are not re-exported by its public
 * entrypoint. Long-term fix: upstream those exports so this file can
 * `import` them.
 */

import type { PetalsIntent } from "./effects-config";

export type PetalSpriteShape =
  // Generic procedural - used by custom palette + jsdom fallback.
  | "round"
  | "oval"
  | "elongated"
  | "stylized"
  // Blossom (procedural, cherry-blossom-flavoured).
  | "blossom_flower"
  | "blossom_petal"
  // UXWing autumn leaves (real SVG paths, free commercial).
  | "maple"
  | "curved"
  | "oak"
  | "rounded"
  | "double"
  | "nature"
  // Jungle - hand-authored SVG paths.
  | "monstera"
  | "banana"
  | "fern"
  | "elephant"
  // Gold hero - hand-authored.
  | "ginkgo";

export interface PetalPalette {
  readonly id: PetalsIntent["palette"];
  readonly sprites: readonly PetalSpriteShape[];
  readonly tints: readonly string[];
  readonly emberEdge?: { chance: number; color: string };
}

/* ---------------------------------------------------------------------- */
/*                            Palette registries                          */
/* ---------------------------------------------------------------------- */

const BLOSSOM: PetalPalette = {
  id: "blossom",
  // 1 flower for every 7 petals - the full flower is a rare accent; loose
  // petals carry the stream. (Was 1:3, which read as too many big flowers.)
  sprites: [
    "blossom_flower",
    "blossom_petal",
    "blossom_petal",
    "blossom_petal",
    "blossom_petal",
    "blossom_petal",
    "blossom_petal",
    "blossom_petal",
  ],
  // Cherry blossom colour mix: vibrant magenta/pink/blush + rose/pink/
  // cream/lavender, carried over from the package palette.
  tints: [
    "#ff3d8b",
    "#ff6aa5",
    "#ffb3c8",
    "#e85090",
    "#ffc8d8",
    "#fff2e8",
    "#e8c8e8",
    "#ffa0c0",
  ],
};

const AUTUMN: PetalPalette = {
  id: "autumn",
  sprites: ["maple", "curved", "oak", "rounded", "double", "nature"],
  // Warm autumnal: golds → oranges → reds → browns → a hint of green.
  tints: [
    "#e8a317",
    "#ffcf4a",
    "#ff8a2a",
    "#d9541c",
    "#b8351f",
    "#7a3810",
    "#3f6b2a",
  ],
};

const GOLD: PetalPalette = {
  id: "gold",
  // Ginkgo dominates, with a few rounded/oval leaves to add silhouette
  // variety so the stream doesn't read as one repeating shape.
  sprites: ["ginkgo", "ginkgo", "ginkgo", "rounded", "oval"],
  tints: [
    "#ffcf4a",
    "#ffd96b",
    "#e8a317",
    "#d97818",
    "#f5b947",
    "#f7dc8f",
    "#b8782a",
  ],
};

const ASH: PetalPalette = {
  id: "ash",
  // Subset of autumn leaves - we tint them charcoal and occasionally light
  // an ember along the rim.
  sprites: ["maple", "oak", "rounded", "double", "curved"],
  tints: ["#1a1a1a", "#333333", "#0f0a08", "#4a3d38", "#2a2020"],
  emberEdge: { chance: 0.2, color: "#ff6020" },
};

const JUNGLE: PetalPalette = {
  id: "jungle",
  sprites: ["monstera", "monstera", "banana", "fern", "elephant"],
  tints: [
    "#1f6b2a",
    "#2d8a39",
    "#3f9c47",
    "#5eae4d",
    "#7cc155",
    "#2b5e2e",
    "#4a7a24",
  ],
};

export const PETAL_PALETTES = {
  blossom: BLOSSOM,
  autumn: AUTUMN,
  jungle: JUNGLE,
  ash: ASH,
  gold: GOLD,
} as const;

export function resolvePetalPalette(intent: PetalsIntent): PetalPalette {
  if (intent.palette !== "custom") {
    return PETAL_PALETTES[intent.palette];
  }
  return deriveCustomPalette(intent.customColor);
}

/**
 * Custom palette: tints derived from a single base colour via HSL
 * lightness shifts, sprites borrowed from the blossom petal roster.
 */
export function deriveCustomPalette(hex: string): PetalPalette {
  const base = hexToHsl(hex);
  const lighter = hslToHex({ h: base.h, s: base.s, l: clamp01(base.l + 0.1) });
  const darker = hslToHex({ h: base.h, s: base.s, l: clamp01(base.l - 0.1) });
  return {
    id: "custom",
    sprites: ["round", "round", "oval"],
    tints: [hex, lighter, darker],
  };
}

export function pickPetalSprite(
  palette: PetalPalette,
  rand: () => number = Math.random,
): PetalSpriteShape {
  const n = palette.sprites.length;
  return palette.sprites[Math.floor(rand() * n)] ?? "round";
}

export function pickPetalTint(
  palette: PetalPalette,
  rand: () => number = Math.random,
): string {
  const n = palette.tints.length;
  return palette.tints[Math.floor(rand() * n)] ?? "#ffffff";
}

export function rollEmberFlag(
  palette: PetalPalette,
  rand: () => number = Math.random,
): boolean {
  if (!palette.emberEdge) return false;
  return rand() < palette.emberEdge.chance;
}

/* ---------------------------------------------------------------------- */
/*                       SVG path data (production)                       */
/* ---------------------------------------------------------------------- */

interface SvgLeafData {
  d: string;
  viewBox: { width: number; height: number };
  /** Procedural fallback for jsdom / environments without Path2D. */
  fallback: "maple" | "oak" | "elm" | "oval" | "elongated" | "round" | "stylized";
}

// UXWing leaf silhouettes (free commercial use, no attribution required).
// Mirrors AUTUMN_LEAF_PATHS in @austencloud/backgrounds/autumn-drift.
const UXWING_LEAVES: Record<
  "maple" | "curved" | "oak" | "rounded" | "double" | "nature",
  SvgLeafData
> = {
  maple: {
    d: "M55.15,85.62c1.73,11.9-0.93,21.51-8.05,31.37c-1.6,2.21-3.29,3.99-5.25,5.89c-0.01-2.63-1.69-3.76-4.22-4.34C48.04,108.25,52.33,96.9,53.7,85.62h-2.36c-7.79-0.77-16.33,12.35-26.35,15.92c4.77-9.16-0.56-10.4-12.66-6.33c9.05-10.8,9.93-14.79,0-13.35c5.13-3.88,9.9-6.11,14.38-7.02c-9.33-2.97-17.63-7.97-24.64-15.57c13.16-0.48,9.93-9.37-2.05-22.76c15.93,8.01,24.33,9.02,21.73-0.17c4.71,3.18,10.75,9.27,17.11,16.09c-2.45-12.5-4.29-24.34-3.42-33.2C41.63,28.56,48.3,19.12,54.84,0c5.51,17.44,11.43,27.12,18.92,20.08c0.97,7.76-0.07,16.06-2.74,24.81l-0.17,6.67c6.21-6.7,12.31-13.03,17.22-15.44c-3.05,10.09,7.63,6.57,21.28,0.38c-12.92,14.44-13.94,22.06-2.57,22.59c-4.73,7.36-13.07,11.84-22.76,15.23c4.22,1.21,8.44,3.49,12.66,7.02c-8.73-0.72-6.9,5,0.25,14.2c-10.92-3.2-16.49-2.33-13.04,6C70.98,90.74,61.77,85.51,56.13,85.62H55.15L55.15,85.62z",
    viewBox: { width: 109.35, height: 122.88 },
    fallback: "maple",
  },
  curved: {
    d: "M104.38,97.86c5.03,6.72,9.37,12.3,11.72,18.72c2.29,6.26,3.22,9.11-1.98,2.63c-4.84-6.04-9.36-11.91-15.98-17.48c-0.47,0.11-0.96,0.21-1.49,0.32C36.81,113.93-6.78,87.01,0.87,0c46.1,15.96,111.38,9.48,104.62,91.25C105.25,94.29,105.02,96.37,104.38,97.86L104.38,97.86zM88.32,84.78c-15.04-32.4-53.68-43.51-72.85-65.67C36.28,59.7,47.63,57.91,88.32,84.78L88.32,84.78L88.32,84.78z",
    viewBox: { width: 117.93, height: 122.88 },
    fallback: "oval",
  },
  oak: {
    d: "M0.36,15.78c0.3,6.98,0.84,14.42,1.74,21.99l21.5,1.25L0.36,15.78L0.36,15.78zM120.96,113.47l-11.6-10.88c12.55-18.33,15.86-36.43,11.45-54.03c-3.26-9.99-9.58-17.97-17.83-24.33l-1.06,70.41l-5.18-5.09L69.34,8.35c-7.1-4.6-15.3-8.22-24.05-11.05l4.26,61.34l-5.18-5.09L37.16,2.16C23.82,0.6,10.93,0.14,0.18,0.17L0,0v8.84c38.3,38.3,75.14,75.14,112.8,112.8C119.93,126.02,124.49,117.75,120.96,113.47L120.96,113.47zM2.71,42.57c1.27,9.21,3.1,18.52,5.67,27.39l49.54,3.38L28.75,44.17L2.71,42.57L2.71,42.57zM9.87,74.82c2.87,8.74,6.53,16.92,11.18,23.99l61-1.34L63.09,78.51L9.87,74.82L9.87,74.82zM24.45,103.54c6.3,8.04,14.18,14.18,23.99,17.39c16.01,4.01,32.29,1.72,48.9-8.17L87.18,102.6L24.45,103.54L24.45,103.54z",
    viewBox: { width: 124.49, height: 126.02 },
    fallback: "oak",
  },
  rounded: {
    d: "M13.54,97.85c-5.05,6.71-9.37,12.31-11.71,18.72c-2.29,6.25-3.22,9.12,1.97,2.62c4.84-6.04,9.37-11.92,15.97-17.47c0.46,0.12,0.97,0.21,1.48,0.32C81.12,113.94,124.7,87.02,117.04,0C70.96,15.97,5.68,9.47,12.43,91.26C12.69,94.29,12.92,96.37,13.54,97.85L13.54,97.85L13.54,97.85zM27.72,86.1c15.65-33.71,55.85-45.26,75.79-68.3C81.91,59.92,64.23,61.99,27.72,86.1L27.72,86.1z",
    viewBox: { width: 124.7, height: 122.88 },
    fallback: "oval",
  },
  double: {
    d: "M59.07,110.77C110.92,105,139.6,71.12,112.44,0c-21.29,14.9-50.39,24.6-65,44.55C57,52.94,64.89,62.23,67.08,74.37c13.19-16.08,27.63-30.72,35.23-47-7.79,39.07-20,53.84-38.78,73.81a93.64,93.64,0,0,1-4.46,9.62Zm-14.9,4C4,105-15.18,76.09,14.27,24.75c23.8,22.92,65.79,37.48,38.39,85.86a27.08,27.08,0,0,1-1.83,2.93C45.9,89.62,26.21,70.69,20.43,50.61,21.77,83.42,31.23,93,45.88,114.86c-.57,0-1.14-.06-1.71-.13Z",
    viewBox: { width: 139.6, height: 114.86 },
    fallback: "oval",
  },
  nature: {
    d: "M73.65,8.87C88,4.52,103.43,2,118.16.08A3.92,3.92,0,0,1,122.27,6c-6.55,10.32-11.88,21.38-17.19,32.38C86.82,76.25,68.82,113.54,5,122a2.73,2.73,0,0,1-.51.07,3.9,3.9,0,0,1-4.18-3.63A119,119,0,0,1,7.53,68.18c5.68-15,14.58-28.66,26.7-39.08,11-9.42,24.68-15.77,39.42-20.23Z",
    viewBox: { width: 122.27, height: 122.07 },
    fallback: "elongated",
  },
};

// Hand-authored tropical leaf silhouettes (single closed paths, viewBox
// 0-100). Kept intentionally simple so they read cleanly at 30-80 px.
const JUNGLE_LEAVES: Record<"monstera" | "banana" | "fern" | "elephant", SvgLeafData> = {
  // Fenestrated Monstera: oval outline with four deep bays per side that
  // echo the iconic splits without requiring interior holes.
  monstera: {
    d: "M50 4 C62 4 72 9 79 18 C84 24 88 31 90 38 C84 36 76 37 72 42 C79 44 85 48 88 54 C80 54 72 55 68 60 C74 63 80 68 83 74 C74 74 66 76 62 82 C67 86 70 90 72 94 C64 96 56 96 50 96 C44 96 36 96 28 94 C30 90 33 86 38 82 C34 76 26 74 17 74 C20 68 26 63 32 60 C28 55 20 54 12 54 C15 48 21 44 28 42 C24 37 16 36 10 38 C12 31 16 24 21 18 C28 9 38 4 50 4 Z",
    viewBox: { width: 100, height: 100 },
    fallback: "oak",
  },
  // Banana leaf: long elegant oval, ~3:1, with a subtle curve at the tip.
  banana: {
    d: "M50 3 C58 6 62 12 64 22 C66 38 66 54 64 72 C62 84 58 92 50 97 C42 92 38 84 36 72 C34 54 34 38 36 22 C38 12 42 6 50 3 Z",
    viewBox: { width: 100, height: 100 },
    fallback: "elongated",
  },
  // Fern frond: pinnate with 8 leaflet pairs tapering to a tip.
  fern: {
    d: "M50 3 C52 8 54 12 56 14 L62 15 L57 20 L66 22 L58 27 L68 30 L59 34 L70 38 L60 42 L70 46 L60 50 L70 54 L59 58 L68 62 L57 66 L64 70 L55 74 L60 78 L52 82 L55 88 L50 97 L45 88 L48 82 L40 78 L45 74 L36 70 L43 66 L32 62 L41 58 L30 54 L40 50 L30 46 L40 42 L30 38 L41 34 L32 30 L42 27 L34 22 L43 20 L38 15 L44 14 C46 12 48 8 50 3 Z",
    viewBox: { width: 100, height: 100 },
    fallback: "elm",
  },
  // Elephant-ear / Alocasia: shield shape with rounded basal lobes.
  elephant: {
    d: "M50 5 C66 5 78 14 84 28 C90 42 90 58 84 72 C78 86 66 95 50 97 C44 92 38 92 32 86 C36 82 38 78 36 74 C28 76 22 74 18 68 C22 64 26 62 28 58 C20 58 14 54 12 46 C18 42 24 40 28 40 C26 32 32 24 40 20 C42 24 46 26 50 22 C54 26 58 24 60 20 C68 24 74 32 72 40 C76 40 82 42 88 46 C86 54 80 58 72 58 C74 62 78 64 82 68 C78 74 72 76 64 74 C62 78 64 82 68 86 C62 92 56 92 50 97 C50 70 50 35 50 5 Z",
    viewBox: { width: 100, height: 100 },
    fallback: "oval",
  },
};

// Gold hero - ginkgo biloba bilobed fan.
const GINKGO: SvgLeafData = {
  d: "M50 95 L46 70 C42 66 36 62 30 56 C22 48 16 38 14 28 C13 22 16 16 22 14 C26 13 30 14 32 18 C34 14 38 10 44 9 C48 8 51 10 52 14 L52 14 C53 10 56 8 60 9 C66 10 70 14 72 18 C74 14 78 13 82 14 C88 16 91 22 90 28 C88 38 82 48 74 56 C68 62 62 66 58 70 L54 95 Z",
  viewBox: { width: 100, height: 100 },
  fallback: "stylized",
};

/* ---------------------------------------------------------------------- */
/*                   Path2D cache + rendering (production)                */
/* ---------------------------------------------------------------------- */

const hasPath2D = typeof Path2D !== "undefined" && typeof DOMMatrix !== "undefined";

const pathCache = new Map<string, Path2D>();

function getOrBuildPath(
  key: string,
  data: SvgLeafData,
  size: number,
): Path2D | null {
  if (!hasPath2D) return null;
  const cacheKey = `${key}-${Math.round(size)}`;
  const hit = pathCache.get(cacheKey);
  if (hit) return hit;
  try {
    const maxDim = Math.max(data.viewBox.width, data.viewBox.height);
    // Scale so the leaf fits in a (2 * size) box; size = half-width.
    const scale = (size * 2) / maxDim;
    const offsetX = -data.viewBox.width / 2;
    const offsetY = -data.viewBox.height / 2;
    const matrix = new DOMMatrix()
      .scaleSelf(scale, scale)
      .translateSelf(offsetX, offsetY);
    const original = new Path2D(data.d);
    const scaled = new Path2D();
    scaled.addPath(original, matrix);
    pathCache.set(cacheKey, scaled);
    return scaled;
  } catch {
    // Path2D is available but the path failed to parse - extremely rare,
    // but don't crash. Fall back to procedural.
    return null;
  }
}

/**
 * Fill + stroke a leaf with a painted radial gradient (bright centre →
 * base tint → darker rim) and a subtle darker outline for definition.
 * Mirrors the LeafSystem.draw kernel in @austencloud/backgrounds.
 */
function paintLeaf(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  path: Path2D,
  size: number,
  tint: string,
): void {
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.9);
  gradient.addColorStop(0, adjustBrightness(tint, 1.25));
  gradient.addColorStop(0.55, tint);
  gradient.addColorStop(1, adjustBrightness(tint, 0.65));
  ctx.fillStyle = gradient;
  ctx.fill(path);
  ctx.strokeStyle = adjustBrightness(tint, 0.5);
  ctx.lineWidth = Math.max(0.5, size * 0.04);
  ctx.stroke(path);
}

/* ---------------------------------------------------------------------- */
/*                        Public draw entry points                        */
/* ---------------------------------------------------------------------- */

/**
 * Draw a petal silhouette at the origin with a given size (half-width in
 * px). Caller handles translation, rotation, and alpha.
 */
export function drawPetalSilhouette(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  shape: PetalSpriteShape,
  size: number,
  tint: string,
): void {
  switch (shape) {
    case "blossom_flower":
      drawBlossomFlower(ctx, size, tint);
      return;
    case "blossom_petal":
      drawBlossomPetal(ctx, size, tint);
      return;
    case "maple":
    case "curved":
    case "oak":
    case "rounded":
    case "double":
    case "nature":
      drawUxwingLeaf(ctx, shape, size, tint);
      return;
    case "monstera":
    case "banana":
    case "fern":
    case "elephant":
      drawJungleLeaf(ctx, shape, size, tint);
      return;
    case "ginkgo":
      drawGinkgo(ctx, size, tint);
      return;
    case "round":
      drawProceduralShape(ctx, "round", size, tint);
      return;
    case "oval":
      drawProceduralShape(ctx, "oval", size, tint);
      return;
    case "elongated":
      drawProceduralShape(ctx, "elongated", size, tint);
      return;
    case "stylized":
      drawProceduralShape(ctx, "stylized", size, tint);
      return;
  }
}

/**
 * Ember rim - additive orange glow along the silhouette outline. Gated on
 * the same shape dispatch so the stroke and the fill trace the same path.
 */
export function drawPetalEmberRim(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  shape: PetalSpriteShape,
  size: number,
  color: string,
  alpha: number,
): void {
  const prevAlpha = ctx.globalAlpha;
  const prevComposite = ctx.globalCompositeOperation;
  try {
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.6, size * 0.14);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const svgData = getSvgDataForShape(shape);
    if (svgData) {
      const path = getOrBuildPath(`ember-${shape}`, svgData, size);
      if (path) {
        ctx.stroke(path);
        return;
      }
      // Path2D unavailable - fall through to procedural stroke.
      strokeProceduralShape(ctx, svgData.fallback, size);
      return;
    }

    // Pure-procedural shape: stroke it directly.
    if (
      shape === "round" ||
      shape === "oval" ||
      shape === "elongated" ||
      shape === "stylized"
    ) {
      strokeProceduralShape(ctx, shape, size);
      return;
    }

    if (shape === "blossom_flower" || shape === "blossom_petal") {
      // Ember on a blossom petal: trace a simple oval - the flower's
      // multi-path geometry doesn't need a per-petal outline.
      strokeProceduralShape(ctx, "oval", size);
      return;
    }
  } finally {
    ctx.globalAlpha = prevAlpha;
    ctx.globalCompositeOperation = prevComposite;
  }
}

function getSvgDataForShape(shape: PetalSpriteShape): SvgLeafData | null {
  switch (shape) {
    case "maple":
    case "curved":
    case "oak":
    case "rounded":
    case "double":
    case "nature":
      return UXWING_LEAVES[shape];
    case "monstera":
    case "banana":
    case "fern":
    case "elephant":
      return JUNGLE_LEAVES[shape];
    case "ginkgo":
      return GINKGO;
    default:
      return null;
  }
}

/* ---------------------------------------------------------------------- */
/*                        Shape-specific implementations                  */
/* ---------------------------------------------------------------------- */

function drawUxwingLeaf(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  shape: "maple" | "curved" | "oak" | "rounded" | "double" | "nature",
  size: number,
  tint: string,
): void {
  const data = UXWING_LEAVES[shape];
  const path = getOrBuildPath(shape, data, size);
  if (path) {
    paintLeaf(ctx, path, size, tint);
    return;
  }
  drawProceduralShape(ctx, data.fallback, size, tint);
}

function drawJungleLeaf(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  shape: "monstera" | "banana" | "fern" | "elephant",
  size: number,
  tint: string,
): void {
  const data = JUNGLE_LEAVES[shape];
  const path = getOrBuildPath(shape, data, size);
  if (path) {
    paintLeaf(ctx, path, size, tint);
    return;
  }
  drawProceduralShape(ctx, data.fallback, size, tint);
}

function drawGinkgo(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  size: number,
  tint: string,
): void {
  const path = getOrBuildPath("ginkgo", GINKGO, size);
  if (path) {
    paintLeaf(ctx, path, size, tint);
    return;
  }
  drawProceduralShape(ctx, GINKGO.fallback, size, tint);
}

/**
 * Blossom 5-petal flower - procedural, port of BlossomPetalSystem
 * drawPetal branch (isFlower === true). Paints a glow ring, 5 radial
 * petals with gradients, then a yellow stamen centre.
 */
function drawBlossomFlower(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  size: number,
  tint: string,
): void {
  const { r, g, b } = hexToRgbTuple(tint);

  // Glow halo. Trimmed from 1.6 - the wide halo made flowers dominate.
  const glowRadius = size * 1.15;
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, glowRadius);
  glow.addColorStop(0, `rgba(${r},${g},${b},0.5)`);
  glow.addColorStop(0.45, `rgba(${r},${g},${b},0.2)`);
  glow.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(-glowRadius, -glowRadius, glowRadius * 2, glowRadius * 2);

  // 5 petals fanned out from centre, each with its own radial gradient.
  const petalCount = 5;
  const widthFactor = 0.45;
  for (let i = 0; i < petalCount; i++) {
    const angle = (i * Math.PI * 2) / petalCount;
    ctx.save();
    ctx.rotate(angle);
    const petalGrad = ctx.createRadialGradient(
      0,
      size * widthFactor,
      0,
      0,
      size * widthFactor,
      size * 0.7,
    );
    petalGrad.addColorStop(0, `rgba(${r},${g},${b},1)`);
    petalGrad.addColorStop(0.6, `rgba(${r},${g},${b},0.75)`);
    petalGrad.addColorStop(1, `rgba(${r},${g},${b},0.15)`);
    ctx.fillStyle = petalGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(
      size * widthFactor,
      size * 0.1,
      size * widthFactor,
      size * 0.45,
    );
    ctx.quadraticCurveTo(
      size * widthFactor,
      size * 0.8,
      0,
      size * 0.95,
    );
    ctx.quadraticCurveTo(
      -size * widthFactor,
      size * 0.8,
      -size * widthFactor,
      size * 0.45,
    );
    ctx.quadraticCurveTo(
      -size * widthFactor,
      size * 0.1,
      0,
      0,
    );
    ctx.fill();
    ctx.restore();
  }

  // Yellow stamen centre.
  const centreRadius = size * 0.22;
  const centreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, centreRadius);
  centreGrad.addColorStop(0, "rgba(255, 230, 70, 1)");
  centreGrad.addColorStop(1, "rgba(245, 180, 40, 0.6)");
  ctx.fillStyle = centreGrad;
  ctx.beginPath();
  ctx.arc(0, 0, centreRadius, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Blossom single petal - procedural ellipse with radial gradient. Drawn
 * upright (long axis = y).
 */
function drawBlossomPetal(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  size: number,
  tint: string,
): void {
  const { r, g, b } = hexToRgbTuple(tint);
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
  grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
  grad.addColorStop(0.65, `rgba(${r},${g},${b},0.75)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0.15)`);
  ctx.fillStyle = grad;
  // Primary ellipse.
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.5, size * 0.9, 0, 0, Math.PI * 2);
  ctx.fill();
  // Secondary ellipse rotated 60° adds the twisted cherry petal read.
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.42, size * 0.78, Math.PI / 3, 0, Math.PI * 2);
  ctx.fill();
}

/* ---------------------------------------------------------------------- */
/*                  Procedural fallbacks + generic shapes                 */
/* ---------------------------------------------------------------------- */

type ProceduralShape = "round" | "oval" | "elongated" | "stylized" | "maple" | "oak" | "elm";

function drawProceduralShape(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  shape: ProceduralShape,
  size: number,
  tint: string,
): void {
  ctx.fillStyle = tint;
  ctx.beginPath();
  buildProceduralPath(ctx, shape, size);
  ctx.fill();
}

function strokeProceduralShape(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  shape: ProceduralShape,
  size: number,
): void {
  ctx.beginPath();
  buildProceduralPath(ctx, shape, size);
  ctx.stroke();
}

function buildProceduralPath(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  shape: ProceduralShape,
  s: number,
): void {
  switch (shape) {
    case "round": {
      ctx.moveTo(0, -s * 0.95);
      ctx.bezierCurveTo(s * 0.9, -s * 0.9, s * 0.95, s * 0.2, s * 0.3, s * 0.95);
      ctx.bezierCurveTo(s * 0.1, s * 0.6, -s * 0.1, s * 0.6, -s * 0.3, s * 0.95);
      ctx.bezierCurveTo(-s * 0.95, s * 0.2, -s * 0.9, -s * 0.9, 0, -s * 0.95);
      ctx.closePath();
      return;
    }
    case "oval": {
      const w = s * 0.65;
      ctx.moveTo(0, -s);
      ctx.bezierCurveTo(w, -s * 0.7, w, s * 0.7, 0, s);
      ctx.bezierCurveTo(-w, s * 0.7, -w, -s * 0.7, 0, -s);
      ctx.closePath();
      return;
    }
    case "elongated": {
      const w = s * 0.3;
      ctx.moveTo(0, -s);
      ctx.bezierCurveTo(w, -s * 0.5, w, s * 0.5, 0, s);
      ctx.bezierCurveTo(-w, s * 0.5, -w, -s * 0.5, 0, -s);
      ctx.closePath();
      return;
    }
    case "stylized": {
      ctx.moveTo(0, -s);
      ctx.bezierCurveTo(s * 0.9, -s * 0.4, s * 0.9, s * 0.4, 0, s);
      ctx.bezierCurveTo(-s * 0.9, s * 0.4, -s * 0.9, -s * 0.4, 0, -s);
      ctx.closePath();
      return;
    }
    case "maple": {
      const lobes = 5;
      const pts: Array<[number, number]> = [];
      for (let i = 0; i < lobes; i++) {
        const tip = (i / lobes) * Math.PI * 2 - Math.PI / 2;
        const valley = ((i + 0.5) / lobes) * Math.PI * 2 - Math.PI / 2;
        pts.push([Math.cos(tip) * s, Math.sin(tip) * s]);
        pts.push([Math.cos(valley) * s * 0.45, Math.sin(valley) * s * 0.45]);
      }
      const first = pts[0];
      if (!first) return;
      ctx.moveTo(first[0], first[1]);
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i]!;
        ctx.lineTo(p[0], p[1]);
      }
      ctx.closePath();
      return;
    }
    case "oak": {
      const w = s * 0.55;
      ctx.moveTo(0, -s);
      ctx.quadraticCurveTo(w * 1.2, -s * 0.7, w * 0.8, -s * 0.4);
      ctx.quadraticCurveTo(w * 1.1, -s * 0.2, w * 0.9, 0);
      ctx.quadraticCurveTo(w * 1.15, s * 0.2, w * 0.8, s * 0.5);
      ctx.quadraticCurveTo(w * 0.9, s * 0.75, 0, s);
      ctx.quadraticCurveTo(-w * 0.9, s * 0.75, -w * 0.8, s * 0.5);
      ctx.quadraticCurveTo(-w * 1.15, s * 0.2, -w * 0.9, 0);
      ctx.quadraticCurveTo(-w * 1.1, -s * 0.2, -w * 0.8, -s * 0.4);
      ctx.quadraticCurveTo(-w * 1.2, -s * 0.7, 0, -s);
      ctx.closePath();
      return;
    }
    case "elm": {
      const w = s * 0.4;
      const serrations = 6;
      ctx.moveTo(0, -s);
      for (let i = 1; i <= serrations; i++) {
        const t = i / serrations;
        const y = -s + 2 * s * t;
        const bulge = w * Math.sin(t * Math.PI) * (i % 2 === 0 ? 1.1 : 0.85);
        ctx.lineTo(bulge, y);
      }
      for (let i = serrations - 1; i >= 0; i--) {
        const t = i / serrations;
        const y = -s + 2 * s * t;
        const bulge = -w * Math.sin(t * Math.PI) * (i % 2 === 0 ? 1.1 : 0.85);
        ctx.lineTo(bulge, y);
      }
      ctx.closePath();
      return;
    }
  }
}

/* ---------------------------------------------------------------------- */
/*                             Colour helpers                             */
/* ---------------------------------------------------------------------- */

interface Hsl {
  h: number;
  s: number;
  l: number;
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function normalizeHex(hex: string): string {
  const s = hex.trim().replace(/^#/, "");
  if (s.length === 3) {
    return s
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return s.length >= 6 ? s.slice(0, 6) : "ffb0c8";
}

function hexToRgb(hex: string): Rgb {
  const s = normalizeHex(hex);
  return {
    r: parseInt(s.slice(0, 2), 16),
    g: parseInt(s.slice(2, 4), 16),
    b: parseInt(s.slice(4, 6), 16),
  };
}

function hexToRgbTuple(hex: string): Rgb {
  return hexToRgb(hex);
}

function adjustBrightness(hex: string, factor: number): string {
  const { r, g, b } = hexToRgb(hex);
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n * factor)));
  const toHex = (n: number) => clamp(n).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToHsl(hex: string): Hsl {
  const { r: ri, g: gi, b: bi } = hexToRgb(hex);
  const r = ri / 255;
  const g = gi / 255;
  const b = bi / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let sat = 0;
  if (max !== min) {
    const d = max - min;
    sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h, s: sat, l };
}

function hslToHex({ h, s, l }: Hsl): string {
  let r: number;
  let g: number;
  let b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (n: number): string =>
    Math.round(clamp01(n) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hue2rgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}
