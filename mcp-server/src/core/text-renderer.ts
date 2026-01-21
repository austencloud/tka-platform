/**
 * Text Renderer for MCP Server
 *
 * Renders headers with word text and difficulty badges, and footers with user info.
 * Ported from the browser's TextRenderer to work with Node.js canvas.
 *
 * Matches the app's visual output:
 * - Georgia Bold font for headers
 * - Level badge with gradient (1-5)
 * - Footer with username, notes, and birthday
 */

import { createCanvas, type Canvas, type CanvasRenderingContext2D, registerFont } from "canvas";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try to register Georgia font if available (Windows paths)
const FONT_PATHS = [
  "C:\\Windows\\Fonts\\georgia.ttf",
  "C:\\Windows\\Fonts\\georgiab.ttf", // Bold
  "/usr/share/fonts/truetype/msttcorefonts/Georgia.ttf", // Linux
  "/Library/Fonts/Georgia.ttf", // macOS
];

let georgiaRegistered = false;

function ensureFontsRegistered(): void {
  if (georgiaRegistered) return;

  for (const fontPath of FONT_PATHS) {
    try {
      if (fs.existsSync(fontPath)) {
        registerFont(fontPath, {
          family: "Georgia",
          weight: fontPath.includes("georgiab") ? "bold" : "normal",
        });
        georgiaRegistered = true;
      }
    } catch {
      // Font registration failed, will use fallback
    }
  }
}

// Font configuration
const TITLE_FONT_FAMILY = "Georgia, Times New Roman, serif";
const FALLBACK_FONT_FAMILY = "sans-serif";

export interface TextRenderOptions {
  darkMode: boolean;
  margin?: number;
}

export interface UserExportInfo {
  userName?: string;
  notes?: string;
  birthday?: Date;
}

/**
 * Render word header at the top of a canvas
 *
 * @param ctx Canvas 2D context to draw on
 * @param word The word to display
 * @param canvasWidth Width of the canvas
 * @param headerHeight Height of the header area
 * @param difficultyLevel Level 1-5 for the badge
 * @param showDifficultyBadge Whether to show the level badge
 * @param darkMode Whether to use dark theme
 */
export function renderWordHeader(
  ctx: CanvasRenderingContext2D,
  word: string,
  canvasWidth: number,
  headerHeight: number,
  difficultyLevel: number = 1,
  showDifficultyBadge: boolean = true,
  darkMode: boolean = true
): void {
  ensureFontsRegistered();

  // Draw header background
  ctx.fillStyle = darkMode
    ? "rgba(10, 10, 15, 0.98)"
    : "rgba(245, 245, 245, 0.98)";
  ctx.fillRect(0, 0, canvasWidth, headerHeight);

  // Draw subtle bottom border
  ctx.strokeStyle = darkMode
    ? "rgba(255, 255, 255, 0.15)"
    : "rgba(0, 0, 0, 0.1)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, headerHeight - 0.5);
  ctx.lineTo(canvasWidth, headerHeight - 0.5);
  ctx.stroke();

  // Calculate font size based on header height (90% of header height)
  const finalFontSize = headerHeight * 0.9;

  // Set font properties - bold weight for emphasis
  ctx.font = `bold ${finalFontSize}px ${TITLE_FONT_FAMILY}`;
  ctx.fillStyle = darkMode ? "#ffffff" : "#1f2937";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Calculate badge size (90% of header height)
  const badgeSize = headerHeight * 0.9;
  const badgePadding = headerHeight * 0.05;
  const centerX = canvasWidth / 2;
  const centerY = headerHeight / 2;

  // Render the word text (only if we have a word)
  if (word && word.trim() !== "") {
    ctx.fillText(word, centerX, centerY);
  }

  // Render level badge on the left side
  if (showDifficultyBadge) {
    renderLevelBadge(
      ctx,
      difficultyLevel,
      badgePadding,
      (headerHeight - badgeSize) / 2,
      badgeSize
    );
  }
}

/**
 * Render a colored level badge with gradient
 * Matches legacy desktop: Georgia Bold font, linear gradient
 * Colors: 1=light gray, 2=silver, 3=gold, 4=purple, 5=red
 */
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

  // Create linear gradient (top-left to bottom-right)
  const gradient = createLevelBadgeGradient(ctx, x, y, size, level);

  // Draw badge circle with gradient
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
  ctx.fillStyle = gradient;
  ctx.fill();

  // Add black border
  const borderWidth = Math.max(1, Math.floor(size / 50));
  ctx.strokeStyle = "black";
  ctx.lineWidth = borderWidth;
  ctx.stroke();

  // Draw level number - Georgia Bold, size = height / 1.75
  const fontSize = Math.floor(size / 1.75);
  ctx.fillStyle = "black";
  ctx.font = `bold ${fontSize}px ${TITLE_FONT_FAMILY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(level.toString(), centerX, centerY);
}

/**
 * Create linear gradient for level badge (top-left to bottom-right)
 * Matches legacy desktop DifficultyLevelGradients exactly
 */
function createLevelBadgeGradient(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  level: number
): CanvasGradient {
  const gradient = ctx.createLinearGradient(x, y, x + size, y + size);

  switch (level) {
    case 1:
      // Pure white - solid color
      gradient.addColorStop(0, "rgb(255, 255, 255)");
      gradient.addColorStop(1, "rgb(255, 255, 255)");
      break;
    case 2:
      // Silver metallic gradient
      gradient.addColorStop(0, "rgb(170, 170, 170)");
      gradient.addColorStop(0.15, "rgb(210, 210, 210)");
      gradient.addColorStop(0.3, "rgb(120, 120, 120)");
      gradient.addColorStop(0.4, "rgb(180, 180, 180)");
      gradient.addColorStop(0.55, "rgb(190, 190, 190)");
      gradient.addColorStop(0.75, "rgb(130, 130, 130)");
      gradient.addColorStop(1, "rgb(110, 110, 110)");
      break;
    case 3:
      // Gold gradient
      gradient.addColorStop(0, "rgb(255, 215, 0)");
      gradient.addColorStop(0.2, "rgb(238, 201, 0)");
      gradient.addColorStop(0.4, "rgb(218, 165, 32)");
      gradient.addColorStop(0.6, "rgb(184, 134, 11)");
      gradient.addColorStop(0.8, "rgb(139, 69, 19)");
      gradient.addColorStop(1, "rgb(85, 107, 47)");
      break;
    case 4:
      // Purple gradient
      gradient.addColorStop(0, "rgb(200, 162, 200)");
      gradient.addColorStop(0.3, "rgb(170, 132, 170)");
      gradient.addColorStop(0.6, "rgb(148, 0, 211)");
      gradient.addColorStop(1, "rgb(100, 0, 150)");
      break;
    case 5:
      // Red/Orange gradient
      gradient.addColorStop(0, "rgb(255, 69, 0)");
      gradient.addColorStop(0.4, "rgb(255, 0, 0)");
      gradient.addColorStop(0.8, "rgb(139, 0, 0)");
      gradient.addColorStop(1, "rgb(100, 0, 0)");
      break;
    default:
      // Fallback to light gray
      gradient.addColorStop(0, "rgb(245, 245, 245)");
      gradient.addColorStop(1, "rgb(245, 245, 245)");
  }

  return gradient;
}

/**
 * Render user info footer at the bottom of a canvas
 *
 * Layout:
 * - Username (bottom-left) - Georgia Bold
 * - Notes (bottom-center) - Georgia Normal
 * - Date (bottom-right) - Georgia Normal
 *
 * @param ctx Canvas 2D context to draw on
 * @param userInfo User information to display
 * @param canvasWidth Width of the canvas
 * @param canvasHeight Height of the canvas
 * @param footerHeight Height of the footer area
 * @param darkMode Whether to use dark theme
 */
export function renderUserInfo(
  ctx: CanvasRenderingContext2D,
  userInfo: UserExportInfo,
  canvasWidth: number,
  canvasHeight: number,
  footerHeight: number,
  darkMode: boolean = true
): void {
  ensureFontsRegistered();

  const footerTop = canvasHeight - footerHeight;

  // Draw footer background
  ctx.fillStyle = darkMode
    ? "rgba(10, 10, 15, 0.98)"
    : "rgba(245, 245, 245, 0.98)";
  ctx.fillRect(0, footerTop, canvasWidth, footerHeight);

  // Draw subtle top border
  ctx.strokeStyle = darkMode
    ? "rgba(255, 255, 255, 0.15)"
    : "rgba(0, 0, 0, 0.1)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, footerTop + 0.5);
  ctx.lineTo(canvasWidth, footerTop + 0.5);
  ctx.stroke();

  // Calculate font size based on footer height (55% of footer height)
  const fontSize = Math.max(10, Math.floor(footerHeight * 0.55));
  const margin = Math.max(8, Math.floor(footerHeight * 0.3));

  // Position text at 55% down within footer
  const yPosition = footerTop + footerHeight * 0.55;

  ctx.fillStyle = darkMode ? "#ffffff" : "black";
  ctx.textBaseline = "middle";

  // Username (bottom-left) - Georgia Bold
  if (userInfo.userName && userInfo.userName.trim() !== "") {
    ctx.font = `bold ${fontSize}px ${TITLE_FONT_FAMILY}`;
    ctx.textAlign = "left";
    ctx.fillText(userInfo.userName, margin, yPosition);
  }

  // Notes (bottom-center) - Georgia Normal
  const notes = userInfo.notes && userInfo.notes.trim() !== ""
    ? userInfo.notes
    : "Created using TKA Scribe";
  ctx.font = `${fontSize}px ${TITLE_FONT_FAMILY}`;
  ctx.textAlign = "center";
  ctx.fillText(notes, canvasWidth / 2, yPosition);

  // Birthday date (bottom-right) - format: M-D-YYYY
  if (userInfo.birthday) {
    const date = userInfo.birthday;
    const dateStr = `${date.getMonth() + 1}-${date.getDate()}-${date.getFullYear()}`;
    ctx.font = `${fontSize}px ${TITLE_FONT_FAMILY}`;
    ctx.textAlign = "right";
    ctx.fillText(dateStr, canvasWidth - margin, yPosition);
  }
}

/**
 * Calculate header height based on step size
 * Header = 1/3 of step size for balanced proportions
 */
export function calculateHeaderHeight(stepSize: number): number {
  return Math.floor(stepSize / 3);
}

/**
 * Calculate footer height based on step size
 * Footer = 1/7 of step size for balanced proportions
 */
export function calculateFooterHeight(stepSize: number): number {
  return Math.floor(stepSize / 7);
}
