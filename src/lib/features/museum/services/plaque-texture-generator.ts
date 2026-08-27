/**
 * Plaque Texture Generator
 *
 * Renders museum plaque text onto OffscreenCanvas for use as Three.js textures.
 * Two visual styles: brass-framed plaque (standard/large) and dev whiteboard.
 * Canvases are cached by key so identical plaques reuse the same texture source.
 */

import type { PlaqueContent, PlaqueSize } from "./types";

// Size configuration

interface SizeConfig {
  width: number;
  height: number;
  style: "plaque" | "whiteboard";
}

const SIZE_CONFIGS: Record<PlaqueSize, SizeConfig> = {
  standard: { width: 512, height: 768, style: "plaque" },
  large: { width: 1024, height: 768, style: "plaque" },
  "dev-whiteboard": { width: 2048, height: 1536, style: "whiteboard" },
};

// Visual theme tokens

interface ThemeTokens {
  background: string;
  border: string;
  borderWidth: number;
  titleColor: string;
  subtitleColor: string;
  bodyColor: string;
  barterColor: string;
  dividerColor: string;
  titleFont: string;
  bodyFont: string;
}

function plaqueTheme(scaleFactor: number): ThemeTokens {
  return {
    background: "#2a2520",
    border: "#c8a050",
    borderWidth: Math.round(8 * scaleFactor),
    titleColor: "#f0d890",
    subtitleColor: "#d0b878",
    bodyColor: "#e0d0b0",
    barterColor: "#b8a878",
    dividerColor: "#c8a050",
    titleFont: "Georgia, 'Times New Roman', serif",
    bodyFont: "Georgia, 'Times New Roman', serif",
  };
}

function whiteboardTheme(scaleFactor: number): ThemeTokens {
  return {
    background: "#f0f0e8",
    border: "#999999",
    borderWidth: Math.round(4 * scaleFactor),
    titleColor: "#1a1a1a",
    subtitleColor: "#444444",
    bodyColor: "#222222",
    barterColor: "#666666",
    dividerColor: "#bbbbbb",
    titleFont: "Consolas, 'Courier New', monospace",
    bodyFont: "Consolas, 'Courier New', monospace",
  };
}

// Font-size helpers - scale proportionally to canvas width

/** Reference width used to define base font sizes. */
const REFERENCE_WIDTH = 512;

interface FontSizes {
  title: number;
  subtitle: number;
  body: number;
  barter: number;
}

function computeFontSizes(
  width: number,
  style: "plaque" | "whiteboard",
): FontSizes {
  const scale = width / REFERENCE_WIDTH;

  if (style === "whiteboard") {
    // Monospace looks best a bit smaller relative to canvas width.
    return {
      title: Math.round(40 * (width / 2048)),
      subtitle: Math.round(28 * (width / 2048)),
      body: Math.round(24 * (width / 2048)),
      barter: Math.round(22 * (width / 2048)),
    };
  }

  return {
    title: Math.round(36 * scale),
    subtitle: Math.round(22 * scale),
    body: Math.round(20 * scale),
    barter: Math.round(18 * scale),
  };
}

// Word-wrap utility

/**
 * Splits text on explicit \n line breaks, then word-wraps each resulting
 * line so it fits within `maxWidth` pixels at the current font.
 */
function wordWrap(
  ctx: OffscreenCanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const hardLines = text.split("\n");
  const wrapped: string[] = [];

  for (const hardLine of hardLines) {
    if (hardLine.trim() === "") {
      wrapped.push("");
      continue;
    }

    const words = hardLine.split(/\s+/);
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && currentLine) {
        wrapped.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      wrapped.push(currentLine);
    }
  }

  return wrapped;
}

// ---------------------------------------------------------------------------
// Canvas cache (module-level singleton)
// ---------------------------------------------------------------------------

const cache = new Map<string, OffscreenCanvas>();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function generateCanvas(
  content: PlaqueContent,
  size: PlaqueSize,
  cacheKey?: string,
  pictograph?: ImageBitmap,
): OffscreenCanvas {
  // When a pictograph is supplied (personal-museum slots), skip the module
  // cache entirely so a reassigned slot never serves a stale composite. The
  // text-only path (official museum) keeps using the cache, byte-identical.
  if (cacheKey && !pictograph) {
    const cached = cache.get(cacheKey);
    if (cached) return cached;
  }

  const config = SIZE_CONFIGS[size];
  const canvas = new OffscreenCanvas(config.width, config.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to acquire 2D context from OffscreenCanvas");

  const scaleFactor = config.width / REFERENCE_WIDTH;
  const theme =
    config.style === "whiteboard"
      ? whiteboardTheme(scaleFactor)
      : plaqueTheme(scaleFactor);
  const fonts = computeFontSizes(config.width, config.style);
  const padding = Math.round(32 * scaleFactor);
  const contentWidth = config.width - padding * 2;

  // Background
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, config.width, config.height);

  // Border
  drawBorder(ctx, config.width, config.height, theme);

  let y = padding + theme.borderWidth;

  // Title
  ctx.fillStyle = theme.titleColor;
  ctx.font = `bold ${fonts.title}px ${theme.titleFont}`;
  ctx.textAlign = "center";
  const titleLines = wordWrap(ctx, content.title, contentWidth);
  for (const line of titleLines) {
    y += fonts.title * 1.3;
    ctx.fillText(line, config.width / 2, y);
  }

  // Subtitle
  if (content.subtitle) {
    ctx.fillStyle = theme.subtitleColor;
    ctx.font = `italic ${fonts.subtitle}px ${theme.titleFont}`;
    y += fonts.subtitle * 1.4;
    ctx.fillText(content.subtitle, config.width / 2, y);
  }

  // Divider
  y += Math.round(16 * scaleFactor);
  drawDivider(ctx, config.width, y, padding, theme);
  y += Math.round(16 * scaleFactor);

  // Pictograph (personal-museum slots only) - centered square above the body.
  // Sized to ~60% of content width, capped so it never crowds the body text.
  if (pictograph) {
    const picSize = Math.min(contentWidth * 0.6, config.height * 0.32);
    const picX = (config.width - picSize) / 2;
    y += Math.round(12 * scaleFactor);
    ctx.drawImage(pictograph, picX, y, picSize, picSize);
    y += picSize + Math.round(12 * scaleFactor);
  }

  // Body text - left-aligned, word-wrapped
  ctx.fillStyle = theme.bodyColor;
  ctx.font = `${fonts.body}px ${theme.bodyFont}`;
  ctx.textAlign = "left";
  const bodyLines = wordWrap(ctx, content.body, contentWidth);
  const bodyLineHeight = fonts.body * 1.5;

  for (const line of bodyLines) {
    y += bodyLineHeight;
    // Stop rendering if we'd overflow into the barter area
    if (y > config.height - padding - fonts.barter * 2) break;
    ctx.fillText(line, padding, y);
  }

  // Footer - anchored near the bottom
  if (content.barter) {
    const barterY = config.height - padding - theme.borderWidth;
    ctx.fillStyle = theme.barterColor;
    ctx.font = `italic ${fonts.barter}px ${theme.bodyFont}`;
    ctx.textAlign = "center";
    ctx.fillText(content.barter, config.width / 2, barterY);
  }

  // Never cache a pictograph composite (see cache-skip note above).
  if (cacheKey && !pictograph) {
    cache.set(cacheKey, canvas);
  }

  return canvas;
}

// ---------------------------------------------------------------------------
// Private drawing helpers
// ---------------------------------------------------------------------------

function drawBorder(
  ctx: OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  theme: ThemeTokens,
): void {
  const bw = theme.borderWidth;
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = bw;
  // Inset by half the border width so the stroke is fully visible.
  const offset = bw / 2;
  ctx.strokeRect(offset, offset, width - bw, height - bw);
}

function drawDivider(
  ctx: OffscreenCanvasRenderingContext2D,
  canvasWidth: number,
  y: number,
  padding: number,
  theme: ThemeTokens,
): void {
  ctx.strokeStyle = theme.dividerColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, y);
  ctx.lineTo(canvasWidth - padding, y);
  ctx.stroke();
}
