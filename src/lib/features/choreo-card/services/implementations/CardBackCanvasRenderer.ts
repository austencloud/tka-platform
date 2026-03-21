/**
 * CardBackCanvasRenderer
 *
 * Draws a choreo card back onto an HTML Canvas at MakePlayingCards.com
 * specifications (822x1122 px at 300 DPI). Replicates the layout of
 * CardBackV5.svelte using only the Canvas 2D API — no DOM, no SVG loading.
 *
 * The Svelte component was designed at a 500x700 reference size. The print
 * canvas is 822x1122 with 36px bleed on each side, giving a 750x1050
 * content area. Scale factor from reference to content = 1.5x.
 */

import type { ICardBackCanvasRenderer, CardBackCanvasOptions } from "../contracts/ICardBackCanvasRenderer";
import type { CardBackData } from "../../components/card-back/card-back-data";
import { getCardBackThemeVisuals } from "../../components/card-back/card-back-theme-visuals";
import type { CardBackThemeVisuals } from "../../components/card-back/card-back-theme-visuals";
import { LOOPComponent } from "$lib/features/create/generate/shared/domain/models/generate-models";

// ─── Constants ───────────────────────────────────────────────────────

/** Reference dimensions the Svelte component was designed at */
const REF_W = 500;
const REF_H = 700;

/** Scale from reference to the content area (750x1050) */
const SCALE = 1.5;

/** Border frame padding at reference size */
const BORDER_PAD_REF = 4;

/** Border radius at reference size */
const BORDER_RADIUS_OUTER_REF = 12;
const BORDER_RADIUS_INNER_REF = 8;

// ─── Pronunciation ───────────────────────────────────────────────────

const LETTER_NAMES: Record<string, string> = {
  "Σ": "Sigma", "Δ": "Delta", "Θ": "Theta", "Ω": "Omega",
  "Φ": "Phi", "Ψ": "Psi", "Λ": "Lambda",
  "Σ-": "Sigma Dash", "Δ-": "Delta Dash", "Θ-": "Theta Dash", "Ω-": "Omega Dash",
  "Φ-": "Phi Dash", "Ψ-": "Psi Dash", "Λ-": "Lambda Dash",
  "α": "alpha", "β": "beta", "γ": "gamma",
  "ζ": "zeta", "η": "eta", "τ": "tau", "τ-": "Tau Dash",
  "μ": "mu", "ν": "nu", "⊕": "terra",
  "W-": "W Dash", "X-": "X Dash", "Y-": "Y Dash", "Z-": "Z Dash",
};

const POSITION_GLYPHS: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ",
  zeta: "ζ", eta: "η", tau: "τ", terra: "⊕",
};

/** Short labels for LOOP component icons */
const LOOP_LABELS: Record<string, string> = {
  [LOOPComponent.ROTATED]: "R",
  [LOOPComponent.MIRRORED]: "M",
  [LOOPComponent.FLIPPED]: "F",
  [LOOPComponent.SWAPPED]: "S",
  [LOOPComponent.INVERTED]: "I",
  [LOOPComponent.REWOUND]: "W",
};

const LOOP_COLORS: Record<string, string> = {
  [LOOPComponent.ROTATED]: "#f59e0b",
  [LOOPComponent.MIRRORED]: "#3b82f6",
  [LOOPComponent.FLIPPED]: "#10b981",
  [LOOPComponent.SWAPPED]: "#a855f7",
  [LOOPComponent.INVERTED]: "#ef4444",
  [LOOPComponent.REWOUND]: "#ec4899",
};

// ─── Gradient Parsing ────────────────────────────────────────────────

interface ParsedStop {
  color: string;
  offset: number;
}

interface ParsedGradient {
  angle: number;
  stops: ParsedStop[];
}

/**
 * Parse a CSS linear-gradient string into angle + color stops.
 * Handles both hex colors and rgba() with commas inside parens.
 */
function parseLinearGradient(css: string): ParsedGradient | null {
  // Match linear-gradient(angle, ...stops)
  const match = css.match(/linear-gradient\(\s*([\d.]+)deg/);
  if (!match) {
    // Try simple "180deg" format
    const simpleMatch = css.match(/linear-gradient\(\s*(\d+)deg/);
    if (!simpleMatch) return null;
  }

  const angleMatch = css.match(/linear-gradient\(\s*(\d+)deg\s*,\s*/);
  if (!angleMatch) return null;

  const angle = parseInt(angleMatch[1]!, 10);

  // Extract everything after the angle
  const afterAngle = css.slice(css.indexOf("deg") + 3).replace(/^\s*,\s*/, "");
  // Remove trailing )
  const stopsStr = afterAngle.replace(/\)\s*$/, "");

  // Split on commas that are NOT inside parentheses
  const stops: ParsedStop[] = [];
  let depth = 0;
  let current = "";

  for (const ch of stopsStr) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;

    if (ch === "," && depth === 0) {
      const parsed = parseStop(current.trim());
      if (parsed) stops.push(parsed);
      current = "";
    } else {
      current += ch;
    }
  }
  // Last stop
  if (current.trim()) {
    const parsed = parseStop(current.trim());
    if (parsed) stops.push(parsed);
  }

  if (stops.length < 2) return null;
  return { angle, stops };
}

function parseStop(raw: string): ParsedStop | null {
  // "rgba(255,0,0,0.12) 0%" or "#ff0000 0%" or "#ff0000"
  const percentMatch = raw.match(/(\d+(?:\.\d+)?)\s*%\s*$/);
  const offset = percentMatch ? parseFloat(percentMatch[1]!) / 100 : 0;

  // Extract the color part (everything before the percentage)
  let color: string;
  if (percentMatch) {
    color = raw.slice(0, raw.lastIndexOf(percentMatch[0]!)).trim();
  } else {
    color = raw.trim();
  }

  if (!color) return null;
  return { color, offset };
}

/**
 * Create a canvas linear gradient from a parsed CSS gradient.
 * Maps the CSS angle to canvas start/end coordinates within the given rect.
 */
function createCanvasGradient(
  ctx: CanvasRenderingContext2D,
  parsed: ParsedGradient,
  x: number, y: number, w: number, h: number
): CanvasGradient {
  // CSS gradient angles: 0deg = bottom-to-top, 90deg = left-to-right, etc.
  // Convert to radians where 0deg points up
  const rad = ((parsed.angle - 90) * Math.PI) / 180;
  const cx = x + w / 2;
  const cy = y + h / 2;

  // The gradient line length needs to cover the entire rectangle.
  // For a rectangle, the diagonal projection determines the length.
  const diagLen = (Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad))) / 2;

  const x0 = cx - diagLen * Math.cos(rad);
  const y0 = cy - diagLen * Math.sin(rad);
  const x1 = cx + diagLen * Math.cos(rad);
  const y1 = cy + diagLen * Math.sin(rad);

  const grad = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const stop of parsed.stops) {
    try {
      grad.addColorStop(stop.offset, stop.color);
    } catch {
      // Skip stops with CSS variables or invalid colors
    }
  }
  return grad;
}

/**
 * Attempt to fill a rect using a CSS gradient string.
 * Falls back to a solid color if the gradient can't be parsed
 * (e.g., contains CSS variables).
 */
function fillWithCSSGradient(
  ctx: CanvasRenderingContext2D,
  css: string,
  x: number, y: number, w: number, h: number,
  fallback: string
): void {
  // Handle multiple layered gradients (e.g., pride theme)
  // Canvas doesn't support multiple fills natively, so we paint them in order
  const gradientParts = splitLayeredGradients(css);

  if (gradientParts.length === 0) {
    ctx.fillStyle = fallback;
    ctx.fillRect(x, y, w, h);
    return;
  }

  // Paint each gradient layer (first layer is the bottom)
  for (const part of gradientParts) {
    const parsed = parseLinearGradient(part.trim());
    if (parsed) {
      ctx.fillStyle = createCanvasGradient(ctx, parsed, x, y, w, h);
      ctx.fillRect(x, y, w, h);
    } else {
      // Might be a solid color or var() reference
      const solidColor = extractSolidColor(part.trim());
      if (solidColor) {
        ctx.fillStyle = solidColor;
        ctx.fillRect(x, y, w, h);
      } else {
        ctx.fillStyle = fallback;
        ctx.fillRect(x, y, w, h);
      }
    }
  }
}

/**
 * Split a CSS background value that may contain multiple comma-separated
 * gradient layers (e.g., pride theme has two linear-gradient layers).
 */
function splitLayeredGradients(css: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";

  for (let i = 0; i < css.length; i++) {
    const ch = css[i]!;
    if (ch === "(") depth++;
    else if (ch === ")") depth--;

    if (ch === "," && depth === 0) {
      // Check if this comma separates gradient layers (not inside a gradient)
      const trimmed = current.trim();
      if (trimmed.startsWith("linear-gradient") || trimmed.startsWith("radial-gradient")) {
        parts.push(trimmed);
        current = "";
        continue;
      }
      // Otherwise it's part of the current gradient (shouldn't happen at depth 0)
      current += ch;
    } else {
      current += ch;
    }
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  // If we only got one part and it wasn't split, return it as-is
  if (parts.length === 0 && css.trim()) {
    parts.push(css.trim());
  }

  return parts;
}

function extractSolidColor(css: string): string | null {
  if (css.startsWith("#") && !css.includes(" ")) return css;
  if (css.startsWith("rgb")) return css;
  return null;
}

// ─── Drawing Helpers ─────────────────────────────────────────────────

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function hasGreekLetters(word: string): boolean {
  for (let i = 0; i < word.length; i++) {
    const ch = word[i]!;
    if (ch in LETTER_NAMES) return true;
    if (i + 1 < word.length && word[i + 1] === "-" && (ch + "-") in LETTER_NAMES) return true;
  }
  return false;
}

function buildPronunciation(word: string): string {
  const parts: string[] = [];
  let i = 0;
  while (i < word.length) {
    // Check for dash-suffix variants first
    if (i + 1 < word.length && word[i + 1] === "-") {
      const twoChar = word[i] + "-";
      if (LETTER_NAMES[twoChar]) {
        parts.push(LETTER_NAMES[twoChar]!);
        i += 2;
        continue;
      }
    }
    const ch = word[i]!;
    if (LETTER_NAMES[ch]) {
      parts.push(LETTER_NAMES[ch]!);
    } else {
      parts.push(ch);
    }
    i++;
  }
  return parts.join(" \u00B7 ");
}

// ─── Implementation ──────────────────────────────────────────────────

export class CardBackCanvasRenderer implements ICardBackCanvasRenderer {

  async render(data: CardBackData, options: CardBackCanvasOptions): Promise<HTMLCanvasElement> {
    const { width, height, bleedPx, theme: themeName } = options;
    const theme = getCardBackThemeVisuals(themeName);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;

    // Content area (inside bleed)
    const cx = bleedPx;
    const cy = bleedPx;
    const cw = width - bleedPx * 2;
    const ch = height - bleedPx * 2;

    // Fill bleed area with a dark color so trimming isn't visible
    ctx.fillStyle = "#060610";
    ctx.fillRect(0, 0, width, height);

    this.drawBorderFrame(ctx, theme, cx, cy, cw, ch);
    this.drawBackground(ctx, theme, cx, cy, cw, ch);
    this.drawCornerBadges(ctx, data, cx, cy, cw, ch);
    this.drawTopBrand(ctx, cx, cy, cw);
    this.drawCenterContent(ctx, data, cx, cy, cw, ch);
    this.drawBottomUrl(ctx, cx, cy, cw, ch);

    return canvas;
  }

  // ─── Border Frame ────────────────────────────────────────────────

  private drawBorderFrame(
    ctx: CanvasRenderingContext2D,
    theme: CardBackThemeVisuals,
    x: number, y: number, w: number, h: number
  ): void {
    const radius = BORDER_RADIUS_OUTER_REF * SCALE;

    ctx.save();
    drawRoundedRect(ctx, x, y, w, h, radius);
    ctx.clip();

    fillWithCSSGradient(ctx, theme.borderGradient, x, y, w, h, "#4338ca");

    ctx.restore();
  }

  // ─── Inner Background ────────────────────────────────────────────

  private drawBackground(
    ctx: CanvasRenderingContext2D,
    theme: CardBackThemeVisuals,
    x: number, y: number, w: number, h: number
  ): void {
    const pad = BORDER_PAD_REF * SCALE;
    const innerX = x + pad;
    const innerY = y + pad;
    const innerW = w - pad * 2;
    const innerH = h - pad * 2;
    const radius = BORDER_RADIUS_INNER_REF * SCALE;

    ctx.save();
    drawRoundedRect(ctx, innerX, innerY, innerW, innerH, radius);
    ctx.clip();

    fillWithCSSGradient(ctx, theme.background, innerX, innerY, innerW, innerH, "#0a0e1a");

    ctx.restore();
  }

  // ─── Corner Badges ───────────────────────────────────────────────

  private drawCornerBadges(
    ctx: CanvasRenderingContext2D,
    data: CardBackData,
    cx: number, cy: number, cw: number, ch: number
  ): void {
    const pad = BORDER_PAD_REF * SCALE;
    const innerX = cx + pad;
    const innerY = cy + pad;
    const innerW = cw - pad * 2;
    const innerH = ch - pad * 2;

    // Corner offset from inner edge: 16px at ref -> scaled
    const cornerOffset = 16 * SCALE;

    this.drawLevelBadge(ctx, data, innerX + cornerOffset, innerY + cornerOffset);

    if (data.hasLoop) {
      this.drawLoopIcons(ctx, data, innerX + innerW - cornerOffset, innerY + cornerOffset);
    }

    this.drawStepCount(ctx, data, innerX + cornerOffset, innerY + innerH - cornerOffset);

    if (data.startPosition) {
      this.drawStartPositionMiniGrid(
        ctx, data.startPosition, innerX + innerW - cornerOffset, innerY + innerH - cornerOffset
      );
    }
  }

  /** Top-left: circular level badge with gradient fill */
  private drawLevelBadge(
    ctx: CanvasRenderingContext2D,
    data: CardBackData,
    x: number, y: number
  ): void {
    const size = 40 * SCALE; // diameter
    const r = size / 2;
    const centerX = x + r;
    const centerY = y + r;

    // Gradient fill for the badge circle
    const parsed = parseLinearGradient(data.level.gradient);

    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
    ctx.closePath();

    if (parsed) {
      ctx.fillStyle = createCanvasGradient(
        ctx, parsed, x, y, size, size
      );
    } else {
      ctx.fillStyle = "#4338ca";
    }
    ctx.fill();

    // Border
    ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
    ctx.lineWidth = 1.5 * SCALE;
    ctx.stroke();

    // Number text
    const fontSize = 24 * SCALE;
    ctx.fillStyle = data.level.textColor || "#ffffff";
    ctx.font = `bold ${fontSize}px Cambria, serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(data.level.number), centerX, centerY + 1 * SCALE);

    ctx.restore();
  }

  /** Top-right: LOOP component icons as colored circles with letter labels */
  private drawLoopIcons(
    ctx: CanvasRenderingContext2D,
    data: CardBackData,
    rightEdge: number, topEdge: number
  ): void {
    const iconSize = 26 * SCALE;
    const gap = 4 * SCALE;
    const components = Array.from(data.loopComponents);

    // Draw right-to-left from the corner edge
    let currentX = rightEdge;

    for (let i = components.length - 1; i >= 0; i--) {
      const comp = components[i]!;
      const r = iconSize / 2;
      const cx = currentX - r;
      const cy = topEdge + r;

      // Colored circle
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = LOOP_COLORS[comp] ?? "#888";
      ctx.fill();

      // Border for legibility
      ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
      ctx.lineWidth = 1 * SCALE;
      ctx.stroke();

      // Letter label
      const fontSize = 14 * SCALE;
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${fontSize}px "Segoe UI", system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(LOOP_LABELS[comp] ?? "?", cx, cy + 0.5 * SCALE);

      ctx.restore();

      currentX -= iconSize + gap;
    }
  }

  /** Bottom-left: step count number with "steps" label below */
  private drawStepCount(
    ctx: CanvasRenderingContext2D,
    data: CardBackData,
    x: number, bottomEdge: number
  ): void {
    const numberSize = 30 * SCALE;
    const sublabelSize = 11 * SCALE;
    const sublabelGap = 4 * SCALE;

    ctx.save();

    // "steps" label at the bottom
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = `500 ${sublabelSize}px "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    // Draw "STEPS" with manual letter-spacing for cross-browser compatibility
    this.drawTextLeftAligned(ctx, "STEPS", x, bottomEdge, sublabelSize * 0.08);

    // Number above it
    ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
    ctx.font = `700 ${numberSize}px "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(String(data.stepCount), x, bottomEdge - sublabelSize - sublabelGap);

    ctx.restore();
  }

  /**
   * Bottom-right: starting position mini-grid.
   * Matches StartPositionMiniGrid.svelte — draws grid point circles
   * (box=cardinal, diamond=intercardinal) with blue/red hand dots.
   */
  private drawStartPositionMiniGrid(
    ctx: CanvasRenderingContext2D,
    info: import("../../components/card-back/card-back-data").StartPositionInfo,
    rightEdge: number, bottomEdge: number
  ): void {
    const size = 40 * SCALE;
    const cx = rightEdge - size / 2;
    const cy = bottomEdge - size / 2;
    const r = size * 0.4;
    const dotR = size * 0.1;
    const centerDotR = size * 0.04;

    const ANGLES: Record<string, number> = {
      n: -Math.PI / 2, ne: -Math.PI / 4, e: 0, se: Math.PI / 4,
      s: Math.PI / 2, sw: (3 * Math.PI) / 4, w: Math.PI, nw: (-3 * Math.PI) / 4,
    };

    const gridPoints =
      info.gridMode === "box" ? ["n", "e", "s", "w"] :
      info.gridMode === "diamond" ? ["ne", "se", "sw", "nw"] :
      ["n", "ne", "e", "se", "s", "sw", "w", "nw"];

    ctx.save();

    // Center dot
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.beginPath();
    ctx.arc(cx, cy, centerDotR, 0, Math.PI * 2);
    ctx.fill();

    // Grid point circles (outline)
    for (const dir of gridPoints) {
      const angle = ANGLES[dir] ?? 0;
      const px = cx + r * Math.cos(angle);
      const py = cy + r * Math.sin(angle);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(px, py, dotR, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Hand position dots
    if (info.blueLocation && info.redLocation && info.blueLocation === info.redLocation) {
      // Beta: both hands same position — purple
      const angle = ANGLES[info.blueLocation] ?? 0;
      ctx.fillStyle = "#9B59B6";
      ctx.beginPath();
      ctx.arc(cx + r * Math.cos(angle), cy + r * Math.sin(angle), dotR, 0, Math.PI * 2);
      ctx.fill();
    } else {
      if (info.blueLocation) {
        const angle = ANGLES[info.blueLocation] ?? 0;
        ctx.fillStyle = "#2E86DE";
        ctx.beginPath();
        ctx.arc(cx + r * Math.cos(angle), cy + r * Math.sin(angle), dotR, 0, Math.PI * 2);
        ctx.fill();
      }
      if (info.redLocation) {
        const angle = ANGLES[info.redLocation] ?? 0;
        ctx.fillStyle = "#E74C3C";
        ctx.beginPath();
        ctx.arc(cx + r * Math.cos(angle), cy + r * Math.sin(angle), dotR, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  // ─── Top Branding ────────────────────────────────────────────────

  private drawTopBrand(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, cw: number
  ): void {
    const pad = BORDER_PAD_REF * SCALE;
    const topOffset = 18 * SCALE;
    const centerX = cx + cw / 2;
    const brandY = cy + pad + topOffset;

    const fontSize = 16 * SCALE;
    const gap = 6 * SCALE;

    ctx.save();
    ctx.textBaseline = "top";

    // Measure "Choreo Card" to position elements
    ctx.font = `700 ${fontSize}px "Segoe UI", system-ui, sans-serif`;
    const brandWidth = ctx.measureText("Choreo Card").width;

    ctx.font = `500 ${fontSize}px "Segoe UI", system-ui, sans-serif`;
    const dotWidth = ctx.measureText("\u00B7").width;
    const subWidth = ctx.measureText("TKA").width;

    const totalWidth = brandWidth + gap + dotWidth + gap + subWidth;
    let drawX = centerX - totalWidth / 2;

    // "Choreo Card"
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = `700 ${fontSize}px "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText("Choreo Card", drawX, brandY);
    drawX += brandWidth + gap;

    // Dot separator
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.font = `500 ${fontSize}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillText("\u00B7", drawX, brandY);
    drawX += dotWidth + gap;

    // "TKA"
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = `500 ${fontSize}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillText("TKA", drawX, brandY);

    ctx.restore();
  }

  // ─── Center Content ──────────────────────────────────────────────

  private drawCenterContent(
    ctx: CanvasRenderingContext2D,
    data: CardBackData,
    cx: number, cy: number, cw: number, ch: number
  ): void {
    const pad = BORDER_PAD_REF * SCALE;
    const centerX = cx + cw / 2;

    // Content padding from Svelte: padding-top 100px at ref
    const topPadding = 100 * SCALE;
    let currentY = cy + pad + topPadding;

    // Word
    const wordSize = 52 * SCALE;
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.font = `600 ${wordSize}px Georgia, serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    // Apply letter spacing by drawing character by character
    this.drawTextWithSpacing(ctx, data.word, centerX, currentY, 0.05 * wordSize);
    currentY += wordSize;

    // Pronunciation guide
    if (hasGreekLetters(data.word)) {
      const pronSize = 13 * SCALE;
      const pronGap = 6 * SCALE;
      currentY += pronGap;

      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.font = `italic ${pronSize}px "Segoe UI", system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(buildPronunciation(data.word), centerX, currentY);
      currentY += pronSize;
    }

    ctx.restore();

    // LOOP explanation — centered vertically in the remaining space
    if (data.hasLoop) {
      const loopText = data.loopExplanation?.summary ?? "Loops back each cycle.";
      const loopSize = 15 * SCALE;
      const maxWidth = 380 * SCALE;

      // Position roughly in the vertical center of the remaining space
      const bottomUrlY = cy + ch - pad - 18 * SCALE;
      const midY = currentY + (bottomUrlY - currentY) / 2;

      ctx.save();
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.font = `${loopSize}px "Segoe UI", system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      this.drawWrappedText(ctx, loopText, centerX, midY, maxWidth, loopSize * 1.6);

      ctx.restore();
    }
  }

  // ─── Bottom URL ──────────────────────────────────────────────────

  private drawBottomUrl(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, cw: number, ch: number
  ): void {
    const pad = BORDER_PAD_REF * SCALE;
    const bottomOffset = 18 * SCALE;
    const centerX = cx + cw / 2;
    const urlY = cy + ch - pad - bottomOffset;

    const fontSize = 12 * SCALE;

    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.font = `${fontSize}px "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("tkaflowarts.com", centerX, urlY);
    ctx.restore();
  }

  // ─── Text Utilities ──────────────────────────────────────────────

  /**
   * Draw left-aligned text with manual letter-spacing.
   * Uses the current textBaseline but overrides textAlign.
   */
  private drawTextLeftAligned(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number, y: number,
    spacing: number
  ): void {
    const prevAlign = ctx.textAlign;
    ctx.textAlign = "left";
    let drawX = x;
    for (const ch of text) {
      ctx.fillText(ch, drawX, y);
      drawX += ctx.measureText(ch).width + spacing;
    }
    ctx.textAlign = prevAlign;
  }

  /**
   * Draw text with manual letter-spacing, since Canvas doesn't support
   * the CSS letter-spacing property reliably across all browsers.
   */
  private drawTextWithSpacing(
    ctx: CanvasRenderingContext2D,
    text: string,
    centerX: number, y: number,
    spacing: number
  ): void {
    // Calculate total width with spacing
    let totalWidth = 0;
    for (const ch of text) {
      totalWidth += ctx.measureText(ch).width + spacing;
    }
    totalWidth -= spacing; // No spacing after last character

    let drawX = centerX - totalWidth / 2;
    for (const ch of text) {
      ctx.fillText(ch, drawX, y);
      drawX += ctx.measureText(ch).width + spacing;
    }
  }

  /**
   * Draw multi-line wrapped text centered at (x, y).
   * Lines are split at word boundaries to fit within maxWidth.
   */
  private drawWrappedText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number, y: number,
    maxWidth: number,
    lineHeight: number
  ): void {
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(testLine).width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);

    // Center the block vertically around y
    const blockHeight = lines.length * lineHeight;
    let lineY = y - blockHeight / 2 + lineHeight / 2;

    for (const line of lines) {
      ctx.fillText(line, x, lineY);
      lineY += lineHeight;
    }
  }
}
