import type { LOOPComponentId, LetterStyle } from "./types.js";
import {
  BADGE_SIZE_SCALE, BADGE_PADDING_SCALE, BADGE_NUMBER_FONT_SCALE, BADGE_BORDER_WIDTH_DIVISOR,
  HEADER_WORD_FONT_SCALE,
  LOOP_ICON_SIZE_SCALE, LOOP_ICON_GAP_SCALE, LOOP_ICON_STRIP_OFFSET_SCALE,
} from "./dimensions.js";
import { DIFFICULTY_LEVELS, DEFAULT_DIFFICULTY_STYLE, DIFFICULTY_FONT_FAMILY, applyGradientStops } from "./difficulty-config.js";
import { renderLoopIconStrip } from "./loop-icons.js";

export interface HeaderOptions {
  canvasWidth: number;
  headerHeight: number;
  word: string;
  difficultyLevel?: number;
  showDifficultyBadge?: boolean;
  loopComponents?: Set<LOOPComponentId>;
  darkMode?: boolean;
  letterStyles?: LetterStyle[];
}

export function renderHeader(ctx: CanvasRenderingContext2D, options: HeaderOptions): void {
  const {
    canvasWidth, headerHeight, word,
    difficultyLevel = 1, showDifficultyBadge = true,
    loopComponents, darkMode = true, letterStyles,
  } = options;

  // Background
  ctx.fillStyle = darkMode ? "rgba(10, 10, 15, 0.98)" : "rgba(245, 245, 245, 0.98)";
  ctx.fillRect(0, 0, canvasWidth, headerHeight);

  // Bottom border
  ctx.strokeStyle = darkMode ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.1)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, headerHeight - 0.5);
  ctx.lineTo(canvasWidth, headerHeight - 0.5);
  ctx.stroke();

  const badgeSize = headerHeight * BADGE_SIZE_SCALE;
  const badgePadding = headerHeight * BADGE_PADDING_SCALE;

  // Difficulty badge (left)
  if (showDifficultyBadge) {
    renderLevelBadge(ctx, difficultyLevel, badgePadding, (headerHeight - badgeSize) / 2, badgeSize);
  }

  // LOOP icon strip (right)
  const hasLoop = loopComponents && loopComponents.size > 0;
  if (hasLoop) {
    const iconSize = badgeSize * LOOP_ICON_SIZE_SCALE;
    const gap = Math.max(2, Math.round(iconSize * LOOP_ICON_GAP_SCALE));
    const activeCount = loopComponents.size;
    const stripWidth = activeCount * iconSize + (activeCount - 1) * gap;
    const rightEdge = canvasWidth - badgePadding;
    const stripCenterX = rightEdge - stripWidth / 2 - iconSize * LOOP_ICON_STRIP_OFFSET_SCALE;
    renderLoopIconStrip(ctx, loopComponents, stripCenterX, headerHeight / 2, iconSize, darkMode);
  }

  // Word text (center)
  const finalFontSize = Math.max(10, Math.floor(headerHeight * HEADER_WORD_FONT_SCALE));
  const textColor = darkMode ? "#ffffff" : "#1f2937";
  const dimmedColor = darkMode ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)";
  ctx.font = `700 ${finalFontSize}px Georgia, serif`;
  ctx.textBaseline = "middle";

  if (word?.trim()) {
    if (letterStyles && letterStyles.length > 0) {
      // Render per-letter with dimming for bridge/derived letters
      const totalWidth = ctx.measureText(word).width;
      let cursorX = canvasWidth / 2 - totalWidth / 2;
      ctx.textAlign = "left";
      for (let i = 0; i < word.length; i++) {
        const char = word[i];
        const style = letterStyles[i];
        ctx.fillStyle = style?.dimmed ? dimmedColor : textColor;
        ctx.fillText(char, cursorX, headerHeight / 2);
        cursorX += ctx.measureText(char).width;
      }
    } else {
      ctx.fillStyle = textColor;
      ctx.textAlign = "center";
      ctx.fillText(word, canvasWidth / 2, headerHeight / 2);
    }
  }
}

function renderLevelBadge(
  ctx: CanvasRenderingContext2D,
  level: number,
  x: number,
  y: number,
  size: number
): void {
  const centerX = x + size / 2;
  const centerY = y + size / 2;
  const radius = size / 2;

  // Linear gradient (top-left to bottom-right) — matches app's TextRenderer
  const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
  const style = DIFFICULTY_LEVELS[level] ?? DEFAULT_DIFFICULTY_STYLE;
  applyGradientStops(gradient, style.stops);

  // Circle with gradient fill
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
  ctx.fillStyle = gradient;
  ctx.fill();

  // Border
  const borderWidth = Math.max(1, Math.floor(size / BADGE_BORDER_WIDTH_DIVISOR));
  ctx.strokeStyle = style.border;
  ctx.lineWidth = borderWidth;
  ctx.stroke();

  // Level number
  const fontSize = Math.floor(size * BADGE_NUMBER_FONT_SCALE);
  ctx.fillStyle = style.text;
  ctx.font = `bold ${fontSize}px ${DIFFICULTY_FONT_FAMILY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(level.toString(), centerX, centerY);
}
