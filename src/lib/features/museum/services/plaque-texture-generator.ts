/**
 * Plaque Texture Generator
 *
 * Renders museum plaque text onto OffscreenCanvas for use as Three.js textures.
 * Seven visual families: the brass museum plaque (standard/large), the dev
 * whiteboard, and the Kinetic Archive's in-fiction surfaces — the Order's
 * institutional card, K's handmade sign, a paper document under glass, a
 * terminal face, and a gift-shop shelf tag. K's sticky-note annotations are
 * composited onto whichever surface they were stuck to.
 *
 * Canvases are cached by key so identical plaques reuse the same texture source.
 */

import type {
  PlaqueAnnotation,
  PlaqueContent,
  PlaqueSize,
  PlaqueStyle,
} from "./types";

// Size configuration

interface SizeConfig {
  width: number;
  height: number;
}

const SIZE_CONFIGS: Record<PlaqueSize, SizeConfig> = {
  standard: { width: 512, height: 768 },
  large: { width: 1024, height: 768 },
  "dev-whiteboard": { width: 2048, height: 1536 },
};

/** The rendered look. `whiteboard` is the dev-whiteboard size's own family. */
type RenderStyle = PlaqueStyle | "whiteboard";

export function resolveRenderStyle(
  content: Pick<PlaqueContent, "style">,
  size: PlaqueSize
): RenderStyle {
  if (size === "dev-whiteboard") return "whiteboard";
  if (content.style && content.style !== "plaque") return content.style;
  return "plaque";
}

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
  titleAlign: CanvasTextAlign;
  titleTransform: "none" | "uppercase";
  /** Institutional header band across the top (the Order's surfaces). */
  band?: { text: string; background: string; color: string };
}

const SERIF = "Georgia, 'Times New Roman', serif";
const MONO = "Consolas, 'Courier New', monospace";
const TYPEWRITER = "'Courier New', Courier, monospace";
const SANS = "Arial, Helvetica, sans-serif";
const MARKER = "'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive";

function themeFor(style: RenderStyle, scaleFactor: number): ThemeTokens {
  const px = (n: number) => Math.round(n * scaleFactor);
  switch (style) {
    case "whiteboard":
      return {
        background: "#f0f0e8",
        border: "#999999",
        borderWidth: px(4),
        titleColor: "#1a1a1a",
        subtitleColor: "#444444",
        bodyColor: "#222222",
        barterColor: "#666666",
        dividerColor: "#bbbbbb",
        titleFont: MONO,
        bodyFont: MONO,
        titleAlign: "center",
        titleTransform: "none",
      };
    case "order":
      return {
        background: "#e9e5da",
        border: "#3a3a3a",
        borderWidth: px(3),
        titleColor: "#1c1c1c",
        subtitleColor: "#4a4a4a",
        bodyColor: "#242424",
        barterColor: "#555555",
        dividerColor: "#3a3a3a",
        titleFont: SANS,
        bodyFont: SANS,
        titleAlign: "left",
        titleTransform: "uppercase",
        band: {
          text: "BUREAU OF KINETIC CONTAINMENT",
          background: "#1c1c1c",
          color: "#e9e5da",
        },
      };
    case "k-sign":
      return {
        background: "#d8c08f",
        border: "#d8c08f",
        borderWidth: 0,
        titleColor: "#161410",
        subtitleColor: "#3a3126",
        bodyColor: "#1c1812",
        barterColor: "#1c1812",
        dividerColor: "#161410",
        titleFont: MARKER,
        bodyFont: MARKER,
        titleAlign: "left",
        titleTransform: "uppercase",
      };
    case "document":
      return {
        background: "#f4efe3",
        border: "#8a8578",
        borderWidth: px(2),
        titleColor: "#1e1c18",
        subtitleColor: "#4a463e",
        bodyColor: "#2a2722",
        barterColor: "#6a655a",
        dividerColor: "#8a8578",
        titleFont: TYPEWRITER,
        bodyFont: TYPEWRITER,
        titleAlign: "left",
        titleTransform: "uppercase",
        band: {
          text: "ARCHIVE COPY · OPEN RECORDS",
          background: "#8a8578",
          color: "#f4efe3",
        },
      };
    case "console":
      return {
        background: "#07100c",
        border: "#1f3a2a",
        borderWidth: px(6),
        titleColor: "#7dff9a",
        subtitleColor: "#4fd37a",
        bodyColor: "#9cf5b0",
        barterColor: "#4fd37a",
        dividerColor: "#1f3a2a",
        titleFont: MONO,
        bodyFont: MONO,
        titleAlign: "left",
        titleTransform: "uppercase",
      };
    case "shelf":
      return {
        background: "#f7f5ee",
        border: "#c9c3b0",
        borderWidth: px(2),
        titleColor: "#222222",
        subtitleColor: "#ffffff",
        bodyColor: "#444444",
        barterColor: "#8a8578",
        dividerColor: "#c9c3b0",
        titleFont: SANS,
        bodyFont: SANS,
        titleAlign: "left",
        titleTransform: "none",
      };
    case "plaque":
    default:
      return {
        background: "#2a2520",
        border: "#c8a050",
        borderWidth: px(8),
        titleColor: "#f0d890",
        subtitleColor: "#d0b878",
        bodyColor: "#e0d0b0",
        barterColor: "#b8a878",
        dividerColor: "#c8a050",
        titleFont: SERIF,
        bodyFont: SERIF,
        titleAlign: "center",
        titleTransform: "none",
      };
  }
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

function computeFontSizes(width: number, style: RenderStyle): FontSizes {
  const scale = width / REFERENCE_WIDTH;

  switch (style) {
    case "whiteboard":
      // Monospace looks best a bit smaller relative to canvas width.
      return {
        title: Math.round(40 * (width / 2048)),
        subtitle: Math.round(28 * (width / 2048)),
        body: Math.round(24 * (width / 2048)),
        barter: Math.round(22 * (width / 2048)),
      };
    case "k-sign":
      return {
        title: Math.round(46 * scale),
        subtitle: Math.round(24 * scale),
        body: Math.round(27 * scale),
        barter: Math.round(24 * scale),
      };
    case "document":
    case "console":
      return {
        title: Math.round(28 * scale),
        subtitle: Math.round(18 * scale),
        body: Math.round(18 * scale),
        barter: Math.round(15 * scale),
      };
    case "order":
      return {
        title: Math.round(30 * scale),
        subtitle: Math.round(18 * scale),
        body: Math.round(19 * scale),
        barter: Math.round(15 * scale),
      };
    case "shelf":
      return {
        title: Math.round(32 * scale),
        subtitle: Math.round(22 * scale),
        body: Math.round(19 * scale),
        barter: Math.round(15 * scale),
      };
    case "plaque":
    default:
      return {
        title: Math.round(36 * scale),
        subtitle: Math.round(22 * scale),
        body: Math.round(20 * scale),
        barter: Math.round(18 * scale),
      };
  }
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

  const style = resolveRenderStyle(content, size);
  const scaleFactor = config.width / REFERENCE_WIDTH;
  const theme = themeFor(style, scaleFactor);
  const fonts = computeFontSizes(config.width, style);
  const padding = Math.round(32 * scaleFactor);
  const contentWidth = config.width - padding * 2;

  // Background
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, config.width, config.height);
  drawSurfaceTexture(ctx, style, config.width, config.height, scaleFactor);

  // Border
  if (theme.borderWidth > 0) drawBorder(ctx, config.width, config.height, theme);

  let y = padding + theme.borderWidth;

  // Institutional header band
  if (theme.band) {
    const bandH = Math.round(fonts.barter * 2.2);
    ctx.fillStyle = theme.band.background;
    ctx.fillRect(theme.borderWidth, theme.borderWidth, config.width - theme.borderWidth * 2, bandH);
    ctx.fillStyle = theme.band.color;
    ctx.font = `bold ${fonts.barter}px ${theme.bodyFont}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(theme.band.text, padding, theme.borderWidth + bandH / 2);
    ctx.textBaseline = "alphabetic";
    y = theme.borderWidth + bandH + padding * 0.8;
  }

  // Tape strips on a handmade sign
  if (style === "k-sign") {
    drawTape(ctx, config.width, scaleFactor);
    y += Math.round(18 * scaleFactor);
  }

  // Title
  const titleX = theme.titleAlign === "center" ? config.width / 2 : padding;
  const titleText =
    theme.titleTransform === "uppercase" ? content.title.toUpperCase() : content.title;
  ctx.fillStyle = theme.titleColor;
  ctx.font = `bold ${fonts.title}px ${theme.titleFont}`;
  ctx.textAlign = theme.titleAlign;
  const titleLines = wordWrap(ctx, titleText, contentWidth);
  for (const line of titleLines) {
    y += fonts.title * 1.3;
    ctx.fillText(line, titleX, y);
  }

  // Subtitle
  if (content.subtitle) {
    if (style === "shelf") {
      // A price tag: orange swing tag with the subtitle in white.
      y += Math.round(14 * scaleFactor);
      const tagH = fonts.subtitle * 1.9;
      ctx.font = `bold ${fonts.subtitle}px ${theme.bodyFont}`;
      const tagW = ctx.measureText(content.subtitle).width + padding;
      ctx.fillStyle = "#e0782a";
      ctx.fillRect(padding, y, tagW, tagH);
      ctx.fillStyle = "#f7f5ee";
      ctx.beginPath();
      ctx.arc(padding + tagH * 0.35, y + tagH / 2, tagH * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = theme.subtitleColor;
      ctx.textAlign = "left";
      ctx.fillText(content.subtitle, padding + tagH * 0.7, y + tagH * 0.68);
      y += tagH;
    } else {
      ctx.fillStyle = theme.subtitleColor;
      ctx.font = `${style === "plaque" ? "italic " : ""}${fonts.subtitle}px ${theme.titleFont}`;
      ctx.textAlign = theme.titleAlign;
      y += fonts.subtitle * 1.4;
      ctx.fillText(content.subtitle, titleX, y);
    }
  }

  // Divider
  y += Math.round(16 * scaleFactor);
  if (style !== "k-sign") drawDivider(ctx, config.width, y, padding, theme);
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
  const bodyLineHeight = fonts.body * (style === "k-sign" ? 1.35 : 1.5);

  for (const line of bodyLines) {
    y += bodyLineHeight;
    // Stop rendering if we'd overflow into the barter area
    if (y > config.height - padding - fonts.barter * 2) break;
    ctx.fillText(line, padding, y);
  }

  // A terminal face ends on a cursor.
  if (style === "console") {
    y += bodyLineHeight;
    if (y <= config.height - padding - fonts.barter * 2) {
      ctx.fillStyle = theme.bodyColor;
      ctx.fillRect(padding, y - fonts.body * 0.85, fonts.body * 0.6, fonts.body);
    }
  }

  // Footer - anchored near the bottom
  if (content.barter) {
    const barterY = config.height - padding - theme.borderWidth;
    ctx.fillStyle = theme.barterColor;
    ctx.font = `${style === "k-sign" ? "" : "italic "}${fonts.barter}px ${theme.bodyFont}`;
    ctx.textAlign = style === "k-sign" ? "right" : "center";
    ctx.fillText(
      content.barter,
      style === "k-sign" ? config.width - padding : config.width / 2,
      barterY
    );
  }

  // The Order's review stamp
  if (style === "order") {
    drawStamp(ctx, config.width, config.height, scaleFactor, "REVIEWED · NO ACTION");
  }

  // K's notes, stuck to the bottom corners
  if (content.annotations?.length) {
    drawAnnotations(ctx, content.annotations, config.width, config.height, scaleFactor);
  }

  // Never cache a pictograph composite (see cache-skip note above).
  if (cacheKey && !pictograph) {
    cache.set(cacheKey, canvas);
  }

  return canvas;
}

/** Sticky-note dimensions as a fraction of the plaque width, for the 3D quad. */
export const STICKY_NOTE_SIZE = 256;

/**
 * A free-standing sticky note (nothing to stick it to): square canvas, yellow
 * paper, marker text. Used for the cave chambers' posted notes.
 */
export function generateStickyNoteCanvas(
  text: string,
  cacheKey?: string
): OffscreenCanvas {
  if (cacheKey) {
    const cached = cache.get(cacheKey);
    if (cached) return cached;
  }
  const canvas = new OffscreenCanvas(STICKY_NOTE_SIZE, STICKY_NOTE_SIZE);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to acquire 2D context from OffscreenCanvas");
  drawStickyNote(ctx, 0, 0, STICKY_NOTE_SIZE, STICKY_NOTE_SIZE, text, 0, 0.5);
  if (cacheKey) cache.set(cacheKey, canvas);
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

/** Paper grain, cardboard fibre, terminal scanlines, shelf dust. */
function drawSurfaceTexture(
  ctx: OffscreenCanvasRenderingContext2D,
  style: RenderStyle,
  width: number,
  height: number,
  scaleFactor: number,
): void {
  // Deterministic pseudo-random so a cached plaque re-renders identically.
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  switch (style) {
    case "console": {
      ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
      const step = Math.max(3, Math.round(4 * scaleFactor));
      for (let y = 0; y < height; y += step) ctx.fillRect(0, y, width, 1);
      // Phosphor bloom in the corners
      const glow = ctx.createRadialGradient(
        width / 2, height / 2, width * 0.2, width / 2, height / 2, width * 0.8
      );
      glow.addColorStop(0, "rgba(0, 0, 0, 0)");
      glow.addColorStop(1, "rgba(0, 0, 0, 0.45)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);
      break;
    }
    case "k-sign": {
      ctx.strokeStyle = "rgba(90, 70, 40, 0.10)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 140; i++) {
        const x = rand() * width;
        const y = rand() * height;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (rand() - 0.5) * 40 * scaleFactor, y + (rand() - 0.5) * 6);
        ctx.stroke();
      }
      break;
    }
    case "document":
    case "order": {
      ctx.fillStyle = "rgba(60, 50, 30, 0.05)";
      for (let i = 0; i < 260; i++) {
        ctx.fillRect(rand() * width, rand() * height, 2 * scaleFactor, 1);
      }
      if (style === "document") {
        // Two punched holes down the left margin
        ctx.fillStyle = "rgba(40, 36, 30, 0.35)";
        for (const fy of [0.3, 0.7]) {
          ctx.beginPath();
          ctx.arc(14 * scaleFactor, height * fy, 6 * scaleFactor, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
    case "shelf": {
      ctx.fillStyle = "rgba(120, 110, 90, 0.10)";
      for (let i = 0; i < 400; i++) {
        ctx.fillRect(rand() * width, rand() * height, 1.5 * scaleFactor, 1.5 * scaleFactor);
      }
      break;
    }
    default:
      break;
  }
}

function drawTape(
  ctx: OffscreenCanvasRenderingContext2D,
  width: number,
  scaleFactor: number,
): void {
  const tapeW = 90 * scaleFactor;
  const tapeH = 26 * scaleFactor;
  ctx.fillStyle = "rgba(235, 225, 200, 0.55)";
  for (const [cx, angle] of [
    [width * 0.18, -0.35],
    [width * 0.82, 0.3],
  ] as const) {
    ctx.save();
    ctx.translate(cx, 10 * scaleFactor);
    ctx.rotate(angle);
    ctx.fillRect(-tapeW / 2, -tapeH / 2, tapeW, tapeH);
    ctx.restore();
  }
}

function drawStamp(
  ctx: OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  scaleFactor: number,
  text: string,
): void {
  const fontPx = Math.round(15 * scaleFactor);
  ctx.save();
  ctx.translate(width - 118 * scaleFactor, height - 92 * scaleFactor);
  ctx.rotate(-0.16);
  ctx.strokeStyle = "rgba(160, 40, 40, 0.55)";
  ctx.lineWidth = 3 * scaleFactor;
  ctx.font = `bold ${fontPx}px ${SANS}`;
  ctx.textAlign = "center";
  const w = ctx.measureText(text).width + 24 * scaleFactor;
  const h = fontPx * 2;
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = "rgba(160, 40, 40, 0.6)";
  ctx.fillText(text, 0, fontPx * 0.36);
  ctx.restore();
}

function drawAnnotations(
  ctx: OffscreenCanvasRenderingContext2D,
  annotations: PlaqueAnnotation[],
  width: number,
  height: number,
  scaleFactor: number,
): void {
  const noteW = Math.min(width * 0.58, 300 * scaleFactor);
  const noteH = noteW * 0.78;
  // Up to two notes on the surface; the panel shows them all.
  const placements: Array<{ x: number; y: number; angle: number }> = [
    { x: width - noteW - 18 * scaleFactor, y: height - noteH - 14 * scaleFactor, angle: -0.06 },
    { x: 14 * scaleFactor, y: height - noteH * 1.55, angle: 0.05 },
  ];
  annotations.slice(0, 2).forEach((note, i) => {
    const p = placements[i]!;
    drawStickyNote(ctx, p.x, p.y, noteW, noteH, note.text, p.angle, scaleFactor);
  });
}

function drawStickyNote(
  ctx: OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  angle: number,
  scaleFactor: number,
): void {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(angle);
  // Shadow, paper, a darker glue strip along the top
  ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
  ctx.fillRect(-w / 2 + 4, -h / 2 + 5, w, h);
  ctx.fillStyle = "#f3dd6d";
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = "rgba(210, 180, 70, 0.55)";
  ctx.fillRect(-w / 2, -h / 2, w, h * 0.09);

  const pad = w * 0.07;
  let fontPx = Math.max(12, Math.round(w * 0.085));
  ctx.fillStyle = "#1a1408";
  ctx.textAlign = "left";
  // Shrink until the note fits its paper.
  for (let attempt = 0; attempt < 6; attempt++) {
    ctx.font = `${fontPx}px ${MARKER}`;
    const lines = wordWrap(ctx, text, w - pad * 2);
    const lineH = fontPx * 1.25;
    if (lines.length * lineH <= h - pad * 2 - h * 0.09 || fontPx <= 11) {
      let ty = -h / 2 + h * 0.09 + pad + fontPx;
      for (const line of lines) {
        ctx.fillText(line, -w / 2 + pad, ty);
        ty += lineH;
      }
      break;
    }
    fontPx = Math.round(fontPx * 0.88);
  }
  void scaleFactor;
  ctx.restore();
}
