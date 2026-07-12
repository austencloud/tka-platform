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

import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

// canvas is an optional dependency - types only
type Canvas = import("canvas").Canvas;
type CanvasRenderingContext2D = import("canvas").CanvasRenderingContext2D;

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

// Try to import canvas at module load time (optional dependency)
let _canvasModule: typeof import("canvas") | null = null;
try {
  _canvasModule = await import("canvas");
} catch {
  // canvas not installed - font registration will be skipped
}

function ensureFontsRegistered(): void {
  if (georgiaRegistered || !_canvasModule) return;

  const { registerFont } = _canvasModule;

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
  /** The word being rendered - used for contextual captions */
  word?: string;
}

/**
 * Letter styling info for rendering the header with bridge/derived letters grayed out
 */
export interface LetterStyle {
  letter: string;
  isBridge: boolean;
  /** Whether this letter is derived from LOOP transformation (dimmed like bridges) */
  isDerived?: boolean;
}

/**
 * Render word header at the top of a canvas
 * @param ctx Canvas 2D context to draw on
 * @param word The word to display (used if letterStyles not provided)
 * @param canvasWidth Width of the canvas
 * @param headerHeight Height of the header area
 * @param difficultyLevel Level 1-5 for the badge
 * @param showDifficultyBadge Whether to show the level badge
 * @param darkMode Whether to use dark theme
 * @param letterStyles Optional array of letter styles (shows bridge letters grayed out)
 * @param loopComponents Optional array of active LOOP components to show in glyph
 */
export function renderWordHeader(
  ctx: CanvasRenderingContext2D,
  word: string,
  canvasWidth: number,
  headerHeight: number,
  difficultyLevel: number = 1,
  showDifficultyBadge: boolean = true,
  darkMode: boolean = true,
  letterStyles?: LetterStyle[],
  loopComponents?: LOOPComponent[]
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

  // Calculate badge size (90% of header height)
  const badgeSize = headerHeight * 0.9;
  const badgePadding = headerHeight * 0.05;
  const centerY = headerHeight / 2;

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

  // Render the word text
  if (letterStyles && letterStyles.length > 0) {
    // Render with styled letters (bridges grayed out)
    renderStyledWord(ctx, letterStyles, canvasWidth, centerY, finalFontSize, darkMode);
  } else if (word && word.trim() !== "") {
    // Simple text rendering (backward compatible)
    ctx.font = `bold ${finalFontSize}px ${TITLE_FONT_FAMILY}`;
    ctx.fillStyle = darkMode ? "#ffffff" : "#1f2937";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(word, canvasWidth / 2, centerY);
  }

  // Render LOOP badges in top-right corner (if provided)
  if (loopComponents && loopComponents.length > 0) {
    const singleBadgeSize = badgeSize; // Same size as difficulty badge
    const gap = Math.floor(singleBadgeSize * 0.15);
    const totalWidth = loopComponents.length * singleBadgeSize + (loopComponents.length - 1) * gap;
    const glyphX = canvasWidth - totalWidth - badgePadding;
    const glyphY = (headerHeight - singleBadgeSize) / 2;
    renderLOOPGlyph(ctx, loopComponents, glyphX, glyphY, singleBadgeSize, darkMode);
  }
}

function renderStyledWord(
  ctx: CanvasRenderingContext2D,
  letterStyles: LetterStyle[],
  canvasWidth: number,
  centerY: number,
  fontSize: number,
  darkMode: boolean
): void {
  ctx.textBaseline = "middle";

  // Bridge/derived letters are 60% size and much more faded
  const primaryFontSize = fontSize;
  const secondaryFontSize = fontSize * 0.6;

  // Helper to check if letter should be dimmed (bridge OR derived)
  const isDimmed = (ls: LetterStyle) => ls.isBridge || ls.isDerived;

  // Calculate total width to center the word (accounting for different sizes)
  let totalWidth = 0;
  for (const ls of letterStyles) {
    ctx.font = `bold ${isDimmed(ls) ? secondaryFontSize : primaryFontSize}px ${TITLE_FONT_FAMILY}`;
    totalWidth += ctx.measureText(ls.letter).width;
  }

  // Start position (centered)
  let x = (canvasWidth - totalWidth) / 2;

  // Colors - bridges/derived are very faded (25% opacity)
  const primaryColor = darkMode ? "#ffffff" : "#1f2937";
  const secondaryColor = darkMode ? "rgba(255, 255, 255, 0.25)" : "rgba(31, 41, 55, 0.25)";

  // Render each letter
  ctx.textAlign = "left";
  for (const ls of letterStyles) {
    const currentFontSize = isDimmed(ls) ? secondaryFontSize : primaryFontSize;
    ctx.font = `bold ${currentFontSize}px ${TITLE_FONT_FAMILY}`;
    ctx.fillStyle = isDimmed(ls) ? secondaryColor : primaryColor;

    // Adjust Y position for smaller secondary letters to keep baseline aligned
    const yOffset = isDimmed(ls) ? (primaryFontSize - secondaryFontSize) * 0.15 : 0;
    ctx.fillText(ls.letter, x, centerY + yOffset);

    x += ctx.measureText(ls.letter).width;
  }
}

/**
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
  // Default to "Austen Cloud" for MCP-generated sequences
  const userName = userInfo.userName && userInfo.userName.trim() !== ""
    ? userInfo.userName
    : "Austen Cloud";
  ctx.font = `bold ${fontSize}px ${TITLE_FONT_FAMILY}`;
  ctx.textAlign = "left";
  ctx.fillText(userName, margin, yPosition);

  // Notes (bottom-center) - Georgia Normal
  // Check for contextual caption based on word content
  const contextualCaption = userInfo.word ? getContextualCaption(userInfo.word) : null;

  // Default when no contextual caption matches
  const defaultNote = "Created with Flow Arts Composer";
  const notes = userInfo.notes && userInfo.notes.trim() !== ""
    ? userInfo.notes
    : contextualCaption ?? defaultNote;
  ctx.font = `${fontSize}px ${TITLE_FONT_FAMILY}`;
  ctx.textAlign = "center";
  ctx.fillText(notes ?? "Conjured by Claude", canvasWidth / 2, yPosition);

  // Date (bottom-right) - format: M-D-YYYY
  // Use provided birthday or default to today's date
  const date = userInfo.birthday ?? new Date();
  const dateStr = `${date.getMonth() + 1}-${date.getDate()}-${date.getFullYear()}`;
  ctx.font = `${fontSize}px ${TITLE_FONT_FAMILY}`;
  ctx.textAlign = "right";
  ctx.fillText(dateStr, canvasWidth - margin, yPosition);
}

/**
 *
 * Humor Profile (derived from user preference quiz, Jan 2026):
 * - Primary: DEADPAN (flat, understated observations)
 * - Secondary: ABSURDIST (non-sequiturs, intentional ambiguity) + SARDONIC (bitter cultural obs)
 * - Tertiary: DICTIONARY (fake definitions with semicolons) + DOMAIN (flow arts in-jokes)
 * - Likes: Intentional ambiguity, double meanings, skepticism of claims
 * - Avoid: Self-deprecating humor, Twitter-specific references
 *
 * The funniest outcome is often no caption at all for words we don't recognize.
 */
function getContextualCaption(word: string): string | null {
  const upper = word.toUpperCase();

  // Curated captions from user preference quiz (Jan 2026)
  // Each was selected from 4 options representing different comedy lenses
  const curatedCaptions: Record<string, string> = {
    // === ROUND 1: Initial quiz ===
    "BIGDICK": "Narrator: It wasn't",
    "BUTTHOLE": "A hole lot of talent",
    "LOSER": "At least you're honest",
    "PENIS": "Anatomy 101",
    "DADDY": "Call me that again",
    "SATAN": "Hell yeah",
    "MOIST": "Your discomfort is valid",
    "KAREN": "I need to speak to the choreographer",
    "THICC": "The C's are load-bearing",
    "VEGAN": "We get it",
    "CUMSHOT": "Photography term, obviously",
    "POOP": "Timeless",
    "BOOBS": "Calculator humor never dies",
    "SEXY": "Debatable",
    "NICE": "Nice",
    "FART": "The body keeps the score",
    "BALLS": "Plural for emphasis",
    "SIMP": "The DMs are open",
    "YEET": "Maximum velocity achieved",
    "LOVE": "Tennis scoring is weird",
    "WEED": "For gardening purposes",
    "HELP": "Blink twice if you need it",
    "CHAD": "Peak prop confidence",
    "NERD": "Correct",
    "MILF": "Man I Love Flow-arts",
    "SLAY": "The props fear you",
    "DEAD": "Inside or outside?",

    // === ROUND 2: Profanity/crude (user-approved) ===
    "SHIT": "Poetry",
    "FUCK": "Expressive",
    "ASS": "Cheeky",
    "DAMN": "Strong feelings",
    "HELL": "Hot take",
    "BUTT": "See: BUTTHOLE",
    "SEX": "The checkbox kind",
    "CRAP": "Quality content",
    "DUMB": "The compliment or the insult?",
    "STUPID": "Big brain energy",
    "IDIOT": "The Greek root means 'private citizen'",
    "HATE": "The sequel to LOVE",
    "KILL": "Metaphorically",
    "DIE": "The singular of dice",
    "BOOB": "Just the one",
    "PEE": "Going with the flow",
    "SMALLDICK": "Narrator: It wasn't",
    "ASSWIPE": "Mom would be proud",

    // === ROUND 3: Flow arts domain (user-approved) ===
    "FLOW": "The whole point",
    "SPIN": "Revolutionary",
    "FIRE": "Safety third",
    "POI": "The Maori would like a word",
    "STAFF": "HR or prop?",
    "HOOP": "Humans Orbiting Objects Persistently",
    "FAN": "The prop or the admirer?",
    "CLUB": "Carefully Leveraged Utility Baton",
    "JUGGLE": "Controlled chaos",
    "PROP": "Personality extension device",
    "BURN": "The good kind",
    "JAM": "Bring your own props",

    // === ROUND 4: Internet culture (user-approved) ===
    "CRINGE": "(n.) The feeling of watching yourself on video",
    "BASED": "(adj.) Possessing opinions the speaker agrees with",
    "COPE": "(v.) To manage; see also: seethe",
    "MID": "(adj.) Acceptable; technically",
    "GOAT": "(n.) A horned mammal; also: bold claim",
    "SIGMA": "(n.) Summation symbol; also: lone wolf cosplay",
    "ALPHA": "(n.) A position where hands are opposite; wolves optional",
    "BETA": "(n.) A position where hands are together; not an insult",
    "BOOMER": "(n.) Someone born 1946-1964; also: anyone over 30",
    "ZOOMER": "No cap fr fr",
    "BRUH": "The universal response",
    "LMAO": "Laughing, presumably",
    "LMFAO": "Laughing harder, allegedly",
    "WTF": "Valid question",
    "OMG": "Dramatic",
    "LOL": "Were you though?",
    "ROFL": "Carpet burn incoming",
    "YOLO": "Proof pending",
    "SWAG": "(acr.) Spinning With Absolute Grace",
    "EPIC": "Scale: unverified",
    "FAIL": "Learning opportunity",
    "COOL": "Temperature or approval?",
    "DOPE": "Illegal in some states",
    "SICK": "(adj.) Ill; also: impressive; confusing",
    "TRASH": "Oscar the Grouch approved",
    "BASIC": "(adj.) Fundamental; also: Starbucks-adjacent",
  };

  // Check for exact match first
  if (curatedCaptions[upper]) {
    return curatedCaptions[upper];
  }

  // Check for partial matches (word contains a known term)
  for (const [term, caption] of Object.entries(curatedCaptions)) {
    if (upper.includes(term) && term.length >= 4) {
      return caption;
    }
  }

  // No match - return null (often funnier than a forced caption)
  return null;
}

/**
 * LOOP Component colors and quadrant mapping
 * Quadrants are numbered clockwise from top-right:
 * - 0 (top-right): ROTATED
 * - 1 (bottom-right): MIRRORED
 * - 2 (bottom-left): SWAPPED
 * - 3 (top-left): INVERTED
 */
export enum LOOPComponent {
  ROTATED = "rotated",
  MIRRORED = "mirrored",
  FLIPPED = "flipped",
  SWAPPED = "swapped",
  INVERTED = "inverted",
  REWOUND = "rewound",
}

const LOOP_COMPONENT_COLORS: Record<LOOPComponent, string> = {
  [LOOPComponent.ROTATED]: "#36c3ff",   // Cyan
  [LOOPComponent.MIRRORED]: "#6F2DA8", // Purple
  [LOOPComponent.FLIPPED]: "#e91e63",  // Pink
  [LOOPComponent.SWAPPED]: "#2ecc71",  // Emerald
  [LOOPComponent.INVERTED]: "#eb7d00", // Orange
  [LOOPComponent.REWOUND]: "#00bcd4",  // Teal
};

// Font Awesome SVG icon paths for LOOP components
// Embedded from @fortawesome/fontawesome-free/svgs/solid/

const LOOP_ICON_SVG_PATHS: Record<LOOPComponent, { d: string; viewBox: [number, number] }> = {
  // rotate.svg
  [LOOPComponent.ROTATED]: {
    d: "M480.1 192l7.9 0c13.3 0 24-10.7 24-24l0-144c0-9.7-5.8-18.5-14.8-22.2S477.9 .2 471 7L419.3 58.8C375 22.1 318 0 256 0 127 0 20.3 95.4 2.6 219.5 .1 237 12.2 253.2 29.7 255.7s33.7-9.7 36.2-27.1C79.2 135.5 159.3 64 256 64 300.4 64 341.2 79 373.7 104.3L327 151c-6.9 6.9-8.9 17.2-5.2 26.2S334.3 192 344 192l136.1 0zm29.4 100.5c2.5-17.5-9.7-33.7-27.1-36.2s-33.7 9.7-36.2 27.1c-13.3 93-93.4 164.5-190.1 164.5-44.4 0-85.2-15-117.7-40.3L185 361c6.9-6.9 8.9-17.2 5.2-26.2S177.7 320 168 320L24 320c-13.3 0-24 10.7-24 24L0 488c0 9.7 5.8 18.5 14.8 22.2S34.1 511.8 41 505l51.8-51.8C137 489.9 194 512 256 512 385 512 491.7 416.6 509.4 292.5z",
    viewBox: [512, 512],
  },
  // arrows-left-right.svg
  [LOOPComponent.MIRRORED]: {
    d: "M470.6 374.6l96-96c12.5-12.5 12.5-32.8 0-45.3l-96-96c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l41.4 41.4-357.5 0 41.4-41.4c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-96 96c-6 6-9.4 14.1-9.4 22.6s3.4 16.6 9.4 22.6l96 96c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3l-41.4-41.4 357.5 0-41.4 41.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0z",
    viewBox: [576, 512],
  },
  // arrows-up-down.svg
  [LOOPComponent.FLIPPED]: {
    d: "M150.6-22.6c-12.5-12.5-32.8-12.5-45.3 0l-96 96c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L96 77.3 96 434.7 54.6 393.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l96 96c6 6 14.1 9.4 22.6 9.4s16.6-3.4 22.6-9.4l96-96c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-41.4 41.4 0-357.5 41.4 41.4c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3l-96-96z",
    viewBox: [256, 512],
  },
  // shuffle.svg
  [LOOPComponent.SWAPPED]: {
    d: "M403.8 34.4c12-5 25.7-2.2 34.9 6.9l64 64c6 6 9.4 14.1 9.4 22.6s-3.4 16.6-9.4 22.6l-64 64c-9.2 9.2-22.9 11.9-34.9 6.9S384 204.9 384 192l0-32-32 0c-10.1 0-19.6 4.7-25.6 12.8l-32.4 43.2-40-53.3 21.2-28.3C293.3 110.2 321.8 96 352 96l32 0 0-32c0-12.9 7.8-24.6 19.8-29.6zM154 296l40 53.3-21.2 28.3C154.7 401.8 126.2 416 96 416l-64 0c-17.7 0-32-14.3-32-32s14.3-32 32-32l64 0c10.1 0 19.6-4.7 25.6-12.8L154 296zM438.6 470.6c-9.2 9.2-22.9 11.9-34.9 6.9S384 460.9 384 448l0-32-32 0c-30.2 0-58.7-14.2-76.8-38.4L121.6 172.8c-6-8.1-15.5-12.8-25.6-12.8l-64 0c-17.7 0-32-14.3-32-32S14.3 96 32 96l64 0c30.2 0 58.7 14.2 76.8 38.4L326.4 339.2c6 8.1 15.5 12.8 25.6 12.8l32 0 0-32c0-12.9 7.8-24.6 19.8-29.6s25.7-2.2 34.9 6.9l64 64c6 6 9.4 14.1 9.4 22.6s-3.4 16.6-9.4 22.6l-64 64z",
    viewBox: [512, 512],
  },
  // circle-half-stroke.svg
  [LOOPComponent.INVERTED]: {
    d: "M448 256c0-106-86-192-192-192l0 384c106 0 192-86 192-192zM0 256a256 256 0 1 1 512 0 256 256 0 1 1 -512 0z",
    viewBox: [512, 512],
  },
  // backward.svg
  [LOOPComponent.REWOUND]: {
    d: "M204.3 43.1C215.9 32 233 28.9 247.7 35.2S272 56 272 72l0 136.3 172.3-165.1C455.9 32 473 28.9 487.7 35.2S512 56 512 72l0 368c0 16-9.6 30.5-24.3 36.8s-31.8 3.2-43.4-7.9L272 303.7 272 440c0 16-9.6 30.5-24.3 36.8s-31.8 3.2-43.4-7.9l-192-184C4.5 277.3 0 266.9 0 256s4.5-21.3 12.3-28.9l192-184z",
    viewBox: [576, 512],
  },
};


interface PathCmd { cmd: string; args: number[] }

function parseSvgPathData(d: string): PathCmd[] {
  if (!d) return [];
  const commands: PathCmd[] = [];
  const re = /([MmZzLlHhVvCcSsQqTtAa])([^MmZzLlHhVvCcSsQqTtAa]*)/g;
  let m;
  while ((m = re.exec(d)) !== null) {
    const cmd = m[1] ?? "";
    const argsStr = (m[2] ?? "").trim();
    // Handle negative numbers that act as separators (e.g., "10-5" = [10, -5])
    const args = argsStr.length > 0
      ? argsStr.match(/-?\d+\.?\d*(?:e[+-]?\d+)?/gi)?.map(Number) ?? []
      : [];
    commands.push({ cmd, args });
  }
  return commands;
}

/**
 * Assumes canvas is already transformed (translate + scale) to map
 * viewBox coordinates to screen coordinates.
 */
function executeSvgPathOnCanvas(
  ctx: CanvasRenderingContext2D,
  commands: PathCmd[]
): void {
  let curX = 0, curY = 0, startX = 0, startY = 0;
  let lastCpX = 0, lastCpY = 0, lastCmd = "";

  ctx.beginPath();

  for (const { cmd, args } of commands) {
    const isRel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const ax = (rx: number) => isRel ? curX + rx : rx;
    const ay = (ry: number) => isRel ? curY + ry : ry;

    switch (C) {
      case "M": {
        const x = ax(args[0] ?? 0), y = ay(args[1] ?? 0);
        ctx.moveTo(x, y);
        curX = startX = x; curY = startY = y;
        for (let i = 2; i < args.length; i += 2) {
          const lx = ax(args[i] ?? 0), ly = ay(args[i + 1] ?? 0);
          ctx.lineTo(lx, ly); curX = lx; curY = ly;
        }
        break;
      }
      case "L":
        for (let i = 0; i < args.length; i += 2) {
          const x = ax(args[i] ?? 0), y = ay(args[i + 1] ?? 0);
          ctx.lineTo(x, y); curX = x; curY = y;
        }
        break;
      case "H":
        for (const a of args) {
          const x = isRel ? curX + a : a;
          ctx.lineTo(x, curY); curX = x;
        }
        break;
      case "V":
        for (const a of args) {
          const y = isRel ? curY + a : a;
          ctx.lineTo(curX, y); curY = y;
        }
        break;
      case "C":
        for (let i = 0; i < args.length; i += 6) {
          const c1x = ax(args[i]??0), c1y = ay(args[i+1]??0);
          const c2x = ax(args[i+2]??0), c2y = ay(args[i+3]??0);
          const x = ax(args[i+4]??0), y = ay(args[i+5]??0);
          ctx.bezierCurveTo(c1x, c1y, c2x, c2y, x, y);
          lastCpX = c2x; lastCpY = c2y; curX = x; curY = y;
        }
        break;
      case "S":
        for (let i = 0; i < args.length; i += 4) {
          let c1x: number, c1y: number;
          if (lastCmd === "C" || lastCmd === "S") {
            c1x = 2 * curX - lastCpX; c1y = 2 * curY - lastCpY;
          } else { c1x = curX; c1y = curY; }
          const c2x = ax(args[i]??0), c2y = ay(args[i+1]??0);
          const x = ax(args[i+2]??0), y = ay(args[i+3]??0);
          ctx.bezierCurveTo(c1x, c1y, c2x, c2y, x, y);
          lastCpX = c2x; lastCpY = c2y; curX = x; curY = y;
        }
        break;
      case "Q":
        for (let i = 0; i < args.length; i += 4) {
          const cpx = ax(args[i]??0), cpy = ay(args[i+1]??0);
          const x = ax(args[i+2]??0), y = ay(args[i+3]??0);
          ctx.quadraticCurveTo(cpx, cpy, x, y);
          lastCpX = cpx; lastCpY = cpy; curX = x; curY = y;
        }
        break;
      case "T":
        for (let i = 0; i < args.length; i += 2) {
          let cpx: number, cpy: number;
          if (lastCmd === "Q" || lastCmd === "T") {
            cpx = 2 * curX - lastCpX; cpy = 2 * curY - lastCpY;
          } else { cpx = curX; cpy = curY; }
          const x = ax(args[i]??0), y = ay(args[i+1]??0);
          ctx.quadraticCurveTo(cpx, cpy, x, y);
          lastCpX = cpx; lastCpY = cpy; curX = x; curY = y;
        }
        break;
      case "A":
        for (let i = 0; i < args.length; i += 7) {
          const rx = args[i]??0, ry = args[i+1]??0;
          const rotation = args[i+2]??0;
          const largeArc = !!(args[i+3]??0), sweep = !!(args[i+4]??0);
          const x = ax(args[i+5]??0), y = ay(args[i+6]??0);
          svgArcToCanvas(ctx, curX, curY, x, y, rx, ry, rotation, largeArc, sweep);
          curX = x; curY = y;
        }
        break;
      case "Z":
        ctx.closePath();
        curX = startX; curY = startY;
        break;
    }
    lastCmd = C;
  }
}

function svgArcToCanvas(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  rx: number, ry: number, phi: number,
  largeArc: boolean, sweep: boolean
): void {
  if (rx === 0 || ry === 0) { ctx.lineTo(x2, y2); return; }
  const sinPhi = Math.sin(phi * Math.PI / 180);
  const cosPhi = Math.cos(phi * Math.PI / 180);
  const x1p = cosPhi * (x1 - x2) / 2 + sinPhi * (y1 - y2) / 2;
  const y1p = -sinPhi * (x1 - x2) / 2 + cosPhi * (y1 - y2) / 2;
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) { rx *= Math.sqrt(lambda); ry *= Math.sqrt(lambda); }
  const rxSq = rx * rx, rySq = ry * ry, x1pSq = x1p * x1p, y1pSq = y1p * y1p;
  let sq = Math.max(0, (rxSq * rySq - rxSq * y1pSq - rySq * x1pSq) / (rxSq * y1pSq + rySq * x1pSq));
  sq = Math.sqrt(sq) * (largeArc === sweep ? -1 : 1);
  const cxp = sq * rx * y1p / ry, cyp = sq * -ry * x1p / rx;
  const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;
  const vecAngle = (ux: number, uy: number, vx: number, vy: number) => {
    const sign = ux * vy - uy * vx < 0 ? -1 : 1;
    const dot = ux * vx + uy * vy;
    const len = Math.sqrt(ux * ux + uy * uy) * Math.sqrt(vx * vx + vy * vy);
    return sign * Math.acos(Math.max(-1, Math.min(1, dot / len)));
  };
  const theta1 = vecAngle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dtheta = vecAngle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && dtheta > 0) dtheta -= Math.PI * 2;
  else if (sweep && dtheta < 0) dtheta += Math.PI * 2;
  const segs = Math.ceil(Math.abs(dtheta) / (Math.PI / 2));
  const delta = dtheta / segs;
  for (let i = 0; i < segs; i++) {
    const t1 = theta1 + i * delta, t2 = theta1 + (i + 1) * delta;
    const alpha = Math.sin(delta) * (Math.sqrt(4 + 3 * Math.pow(Math.tan(delta / 2), 2)) - 1) / 3;
    const cos1 = Math.cos(t1), sin1 = Math.sin(t1), cos2 = Math.cos(t2), sin2 = Math.sin(t2);
    const p1x = cx + rx * cosPhi * cos1 - ry * sinPhi * sin1;
    const p1y = cy + rx * sinPhi * cos1 + ry * cosPhi * sin1;
    const p2x = cx + rx * cosPhi * cos2 - ry * sinPhi * sin2;
    const p2y = cy + rx * sinPhi * cos2 + ry * cosPhi * sin2;
    const dx1 = -rx * cosPhi * sin1 - ry * sinPhi * cos1;
    const dy1 = -rx * sinPhi * sin1 + ry * cosPhi * cos1;
    const dx2 = -rx * cosPhi * sin2 - ry * sinPhi * cos2;
    const dy2 = -rx * sinPhi * sin2 + ry * cosPhi * cos2;
    ctx.bezierCurveTo(p1x + alpha * dx1, p1y + alpha * dy1, p2x - alpha * dx2, p2y - alpha * dy2, p2x, p2y);
  }
}

/**
 * Uses canvas transforms to scale from viewBox to target size.
 */
function drawLOOPIcon(
  ctx: CanvasRenderingContext2D,
  component: LOOPComponent,
  x: number,
  y: number,
  size: number,
  color: string
): void {
  const iconData = LOOP_ICON_SVG_PATHS[component];
  if (!iconData) return;

  const [vbW, vbH] = iconData.viewBox;
  const scale = Math.min(size / vbW, size / vbH);

  // Padding to keep icon from touching badge edges
  const padding = size * 0.15;
  const innerSize = size - padding * 2;
  const innerScale = Math.min(innerSize / vbW, innerSize / vbH);

  ctx.save();

  // Translate and scale so viewBox coordinates map to the target rectangle
  ctx.translate(
    x + (size - vbW * innerScale) / 2,
    y + (size - vbH * innerScale) / 2
  );
  ctx.scale(innerScale, innerScale);

  // Draw shadow
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
  ctx.shadowBlur = 2 / innerScale;
  ctx.shadowOffsetY = 1 / innerScale;

  ctx.fillStyle = color;
  const commands = parseSvgPathData(iconData.d);
  executeSvgPathOnCanvas(ctx, commands);
  ctx.fill();

  ctx.restore();
}

/**
 * Render LOOP badges - individual icon badges for each active LOOP component
 *
 * Design:
 * - Each active component rendered as a colored badge with icon
 * - Badges arranged in a horizontal row
 * - Right-aligned in the header
 * @param ctx Canvas 2D context
 * @param activeComponents Array of active LOOP components
 * @param rightEdge Right edge to align to
 * @param y Top edge of badges
 * @param badgeSize Size of each badge
 * @param darkMode Whether to use dark theme
 * @returns Total width consumed by badges
 */
export function renderLOOPGlyph(
  ctx: CanvasRenderingContext2D,
  activeComponents: LOOPComponent[],
  x: number,
  y: number,
  size: number,
  darkMode: boolean
): void {
  if (activeComponents.length === 0) return;

  const badgeSize = size;
  const gap = Math.floor(size * 0.15);
  const cornerRadius = Math.floor(size * 0.2);

  // Draw badges from left to right (starting at x)
  let currentX = x;

  for (const component of activeComponents) {
    const color = LOOP_COMPONENT_COLORS[component];

    // Draw badge background (rounded rectangle)
    ctx.beginPath();
    ctx.roundRect(currentX, y, badgeSize, badgeSize, cornerRadius);
    ctx.fillStyle = darkMode ? "rgba(0, 0, 0, 0.6)" : "rgba(255, 255, 255, 0.85)";
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Draw the icon
    drawLOOPIcon(ctx, component, currentX, y, badgeSize, color);

    currentX += badgeSize + gap;
  }
}

/**
 * Header = 1/3 of step size for balanced proportions
 */
export function calculateHeaderHeight(stepSize: number): number {
  return Math.floor(stepSize / 3);
}

/**
 * Footer = 1/7 of step size for balanced proportions
 */
export function calculateFooterHeight(stepSize: number): number {
  return Math.floor(stepSize / 7);
}
