import {
  FOOTER_FONT_SCALE, FOOTER_MARGIN_SCALE, FOOTER_TEXT_Y_SCALE,
} from "./dimensions.js";

/** System-generated author identifiers — suppress creator name for these */
const SYSTEM_AUTHORS = new Set(["TKA Enumerator", "TKA System", "TKA Gallery"]);

const BLUE_HAND = "#3575E2";
const RED_HAND = "#ED1C24";
const PIPE_SEPARATOR = " | ";


function drawPipeColoredText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  align: "left" | "right",
  defaultColor: string,
): void {
  const pipeIdx = text.indexOf("|");
  if (pipeIdx === -1) {
    ctx.fillStyle = defaultColor;
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
    return;
  }

  const bluePart = text.slice(0, pipeIdx).trim();
  const redPart = text.slice(pipeIdx + 1).trim();

  const blueW = ctx.measureText(bluePart).width;
  const sepW = ctx.measureText(PIPE_SEPARATOR).width;
  const redW = ctx.measureText(redPart).width;
  const totalW = blueW + sepW + redW;

  const startX = align === "right" ? x - totalW : x;

  ctx.textAlign = "left";
  ctx.fillStyle = BLUE_HAND;
  ctx.fillText(bluePart, startX, y);
  ctx.fillStyle = defaultColor;
  ctx.fillText(PIPE_SEPARATOR, startX + blueW, y);
  ctx.fillStyle = RED_HAND;
  ctx.fillText(redPart, startX + blueW + sepW, y);
}

export interface FooterOptions {
  canvasWidth: number;
  canvasHeight: number;
  footerHeight: number;
  userName?: string;
  notes?: string;
  birthday?: Date;
  darkMode?: boolean;
  showCreatorName?: boolean;
  showNotes?: boolean;
  showBirthday?: boolean;
  /** Override footer background color */
  backgroundColor?: string;
  /** Override footer border color */
  borderColor?: string;
  /** Elemental accent hex color — auto-tinted for bg/border when no explicit overrides */
  accentColor?: string;
  /** CIELAB-tuned tint opacity (0–1) for accent background; overrides default "18" hex */
  accentTintOpacity?: number;
  /** Left-side label override (e.g. "SS 🌊" for VTG cards) */
  leftLabel?: string;
  /** Right-side label override (e.g. "1:1" turn ratio) */
  rightLabel?: string;
  /** Path to an icon image drawn on both sides of center text */
  iconPath?: string;
  /** Pre-loaded icon image — use loadFooterIcon() to obtain */
  iconImage?: CanvasImageSource;
}

const iconCache = new Map<string, CanvasImageSource>();

/**
 * Pre-populate the footer-icon cache with an already-decoded image, keyed by
 * path. Used to seed a Web Worker (which has no `new Image()`): the main thread
 * decodes each deck element's icon to an ImageBitmap, transfers it in, and the
 * worker seeds it here so `loadFooterIcon` hits the cache instead of fetching.
 */
export function seedFooterIcon(path: string, image: CanvasImageSource): void {
  iconCache.set(path, image);
}

export async function loadFooterIcon(path: string): Promise<CanvasImageSource | undefined> {
  const cached = iconCache.get(path);
  if (cached) return cached;
  try {
    const img = new Image();
    img.src = path;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`Failed to load icon: ${path}`));
    });
    iconCache.set(path, img);
    return img;
  } catch {
    return undefined;
  }
}

export function renderFooter(ctx: CanvasRenderingContext2D, options: FooterOptions): void {
  const {
    canvasWidth, canvasHeight, footerHeight,
    userName, notes, birthday,
    darkMode = true,
    showCreatorName = true, showNotes = true, showBirthday = true,
    backgroundColor, borderColor, accentColor, accentTintOpacity,
    leftLabel, rightLabel,
    iconImage, iconPath,
  } = options;

  const footerTop = canvasHeight - footerHeight;

  const accent = !backgroundColor && !darkMode ? accentColor : undefined;
  let footerBg: string;
  if (backgroundColor) {
    footerBg = backgroundColor;
  } else if (accent) {
    const alphaHex = accentTintOpacity
      ? Math.round(accentTintOpacity * 255).toString(16).padStart(2, '0')
      : "18";
    footerBg = accent + alphaHex;
  } else {
    footerBg = darkMode ? "rgba(10, 10, 15, 0.98)" : "rgba(245, 245, 245, 0.98)";
  }
  ctx.fillStyle = footerBg;
  ctx.fillRect(0, footerTop, canvasWidth, footerHeight);

  // Top border — skip when accent tint is active so footer bleeds into content
  if (!accent) {
    ctx.strokeStyle = borderColor ?? (darkMode ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.1)");
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, footerTop + 0.5);
    ctx.lineTo(canvasWidth, footerTop + 0.5);
    ctx.stroke();
  }

  const fontSize = Math.max(10, Math.floor(footerHeight * FOOTER_FONT_SCALE));
  const margin = Math.max(8, Math.floor(footerHeight * FOOTER_MARGIN_SCALE));
  const yPosition = footerTop + footerHeight * FOOTER_TEXT_Y_SCALE;
  const baseColor = darkMode ? "#ffffff" : "black";
  ctx.fillStyle = baseColor;
  ctx.textBaseline = "middle";

  // Left: leftLabel, or username (bold), suppressed for system authors
  if (leftLabel?.trim()) {
    ctx.font = `bold ${fontSize}px Gelasio, Cambria, Georgia, serif`;
    drawPipeColoredText(ctx, leftLabel, margin, yPosition, "left", baseColor);
  } else if (showCreatorName && userName?.trim() && !SYSTEM_AUTHORS.has(userName.trim())) {
    ctx.font = `bold ${fontSize}px Gelasio, Cambria, Georgia, serif`;
    ctx.textAlign = "left";
    ctx.fillText(userName, margin, yPosition);
  }

  // Right: rightLabel or year
  if (rightLabel?.trim()) {
    ctx.font = `bold ${fontSize}px Gelasio, Cambria, Georgia, serif`;
    drawPipeColoredText(ctx, rightLabel, canvasWidth - margin, yPosition, "right", baseColor);
  } else if (showBirthday) {
    const dateToUse = birthday || new Date();
    const year = dateToUse.getFullYear().toString();

    ctx.font = `${fontSize}px Gelasio, Cambria, Georgia, serif`;
    ctx.textAlign = "right";
    ctx.fillText(year, canvasWidth - margin, yPosition);
  }

  // Center: notes or brand name, with optional icons on both sides
  if (showNotes) {
    const centerText = notes?.trim() || "The Kinetic Alphabet";
    ctx.fillStyle = baseColor;
    ctx.font = `${fontSize}px Gelasio, Cambria, Georgia, serif`;
    ctx.textAlign = "center";

    if (iconImage) {
      const textWidth = ctx.measureText(centerText).width;
      const maxH = Math.floor(footerHeight * 0.7);
      const maxW = maxH;
      const srcW = (iconImage as HTMLImageElement).naturalWidth || (iconImage as ImageBitmap).width || maxH;
      const srcH = (iconImage as HTMLImageElement).naturalHeight || (iconImage as ImageBitmap).height || maxH;
      const scale = Math.min(maxW / srcW, maxH / srcH);
      const iconW = Math.round(srcW * scale);
      const iconH = Math.round(srcH * scale);
      const gap = Math.floor(fontSize * 0.35);
      const totalWidth = iconW + gap + textWidth + gap + iconW;
      const startX = (canvasWidth - totalWidth) / 2;
      const iconY = yPosition - iconH / 2;

      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
      ctx.shadowBlur = Math.max(2, Math.floor(maxH * 0.08));
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = Math.max(1, Math.floor(maxH * 0.03));
      ctx.drawImage(iconImage, startX, iconY, iconW, iconH);
      ctx.drawImage(iconImage, startX + iconW + gap + textWidth + gap, iconY, iconW, iconH);
      ctx.restore();

      ctx.textAlign = "left";
      ctx.fillText(centerText, startX + iconW + gap, yPosition);
    } else {
      ctx.fillText(centerText, canvasWidth / 2, yPosition);
    }
  }
}
