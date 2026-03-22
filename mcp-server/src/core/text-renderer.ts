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
 *
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

  // Truncate absurdly long words so the header stays readable
  const truncated = truncateForHeader(word, letterStyles);
  word = truncated.word;
  letterStyles = truncated.letterStyles;

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

  // Calculate base font size from header height (90%)
  const baseFontSize = headerHeight * 0.9;

  // Calculate badge size (90% of header height)
  const badgeSize = headerHeight * 0.9;
  const badgePadding = headerHeight * 0.05;
  const centerY = headerHeight / 2;

  // Calculate available width for the word text (between badges)
  const leftReserved = showDifficultyBadge ? badgeSize + badgePadding * 2 : 0;
  const rightReserved = loopComponents && loopComponents.length > 0
    ? loopComponents.length * badgeSize + (loopComponents.length - 1) * Math.floor(badgeSize * 0.15) + badgePadding * 2
    : 0;
  const availableWidth = canvasWidth - leftReserved - rightReserved - badgePadding * 2;

  // Scale font size down if the word is too wide for the available space
  const finalFontSize = fitFontToWidth(ctx, word, letterStyles, baseFontSize, availableWidth);

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

/** Maximum letter units before truncation with ellipsis */
const MAX_HEADER_LETTERS = 16;

/**
 * Split a TKA word into letter units, where letter+dash (e.g. "W-", "Σ-")
 * counts as a single unit. Returns the individual units.
 */
function splitIntoLetterUnits(word: string): string[] {
  const units: string[] = [];
  let i = 0;
  while (i < word.length) {
    const char = word[i];
    if (!char) break;
    if (/[a-zA-Z\u0370-\u03FF\u1F00-\u1FFF]/.test(char)) {
      if (i + 1 < word.length && word[i + 1] === "-") {
        units.push(char + "-");
        i += 2;
      } else {
        units.push(char);
        i += 1;
      }
    } else {
      i += 1;
    }
  }
  return units;
}

/**
 * Truncate a word to MAX_HEADER_LETTERS letter units, adding "..." if cut.
 * Also truncates the letterStyles array to match.
 */
function truncateForHeader(
  word: string,
  letterStyles?: LetterStyle[]
): { word: string; letterStyles?: LetterStyle[] } {
  const units = splitIntoLetterUnits(word);
  if (units.length <= MAX_HEADER_LETTERS) {
    return { word, letterStyles };
  }

  const truncatedWord = units.slice(0, MAX_HEADER_LETTERS).join("") + "...";
  const truncatedStyles = letterStyles && letterStyles.length > 0
    ? [...letterStyles.slice(0, MAX_HEADER_LETTERS), { letter: "...", isBridge: false, isDerived: false }]
    : undefined;

  return { word: truncatedWord, letterStyles: truncatedStyles };
}

/**
 * Measure how wide the word would be at a given font size, then scale down
 * if it exceeds the available width. Returns the font size to use.
 *
 * For styled words (with bridge/derived letters at 60% size), we measure
 * each letter at its actual rendered size. For plain words, we measure
 * the full string. The font shrinks proportionally so the entire word
 * fits comfortably in the header without overflow.
 */
function fitFontToWidth(
  ctx: CanvasRenderingContext2D,
  word: string,
  letterStyles: LetterStyle[] | undefined,
  baseFontSize: number,
  availableWidth: number
): number {
  if (availableWidth <= 0) return baseFontSize;

  let textWidth: number;

  if (letterStyles && letterStyles.length > 0) {
    // Styled word: measure each letter at its rendered size
    textWidth = 0;
    for (const ls of letterStyles) {
      const isDimmed = ls.isBridge || ls.isDerived;
      const size = isDimmed ? baseFontSize * 0.6 : baseFontSize;
      ctx.font = `bold ${size}px ${TITLE_FONT_FAMILY}`;
      textWidth += ctx.measureText(ls.letter).width;
    }
  } else if (word && word.trim() !== "") {
    // Plain word: measure the whole string
    ctx.font = `bold ${baseFontSize}px ${TITLE_FONT_FAMILY}`;
    textWidth = ctx.measureText(word).width;
  } else {
    return baseFontSize;
  }

  if (textWidth <= availableWidth) return baseFontSize;

  // Scale down proportionally, with a floor of 20% base size
  const scale = availableWidth / textWidth;
  return Math.max(baseFontSize * scale, baseFontSize * 0.2);
}

/**
 * Render word with styled letters (bridge/derived letters smaller and grayed out)
 */
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
  const defaultNote = "Created with TKA Composer";
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
 * Get a contextual caption based on the word content.
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
  [LOOPComponent.SWAPPED]: "#26e600",  // Green
  [LOOPComponent.INVERTED]: "#eb7d00", // Orange
  [LOOPComponent.REWOUND]: "#00bcd4",  // Teal
};

/**
 * Draw a simplified icon for a LOOP component
 * Since we can't use Font Awesome in node-canvas, we draw geometric representations
 */
function drawLOOPIcon(
  ctx: CanvasRenderingContext2D,
  component: LOOPComponent,
  x: number,
  y: number,
  size: number,
  color: string
): void {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size * 0.35; // Icon radius

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.5, size * 0.08);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  switch (component) {
    case LOOPComponent.ROTATED:
      // Circular arrow (rotation symbol)
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI * 0.7, Math.PI * 0.5);
      ctx.stroke();
      // Arrow head
      const arrowTip = { x: cx + r * Math.cos(Math.PI * 0.5), y: cy + r * Math.sin(Math.PI * 0.5) };
      ctx.beginPath();
      ctx.moveTo(arrowTip.x - size * 0.12, arrowTip.y - size * 0.08);
      ctx.lineTo(arrowTip.x, arrowTip.y);
      ctx.lineTo(arrowTip.x + size * 0.08, arrowTip.y - size * 0.12);
      ctx.stroke();
      break;

    case LOOPComponent.MIRRORED:
      // Left-right arrows (horizontal mirror)
      const hw = r * 0.8;
      // Left arrow
      ctx.beginPath();
      ctx.moveTo(cx - hw, cy);
      ctx.lineTo(cx - hw * 0.3, cy);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - hw, cy);
      ctx.lineTo(cx - hw + size * 0.1, cy - size * 0.08);
      ctx.moveTo(cx - hw, cy);
      ctx.lineTo(cx - hw + size * 0.1, cy + size * 0.08);
      ctx.stroke();
      // Right arrow
      ctx.beginPath();
      ctx.moveTo(cx + hw, cy);
      ctx.lineTo(cx + hw * 0.3, cy);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + hw, cy);
      ctx.lineTo(cx + hw - size * 0.1, cy - size * 0.08);
      ctx.moveTo(cx + hw, cy);
      ctx.lineTo(cx + hw - size * 0.1, cy + size * 0.08);
      ctx.stroke();
      // Center line
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.6);
      ctx.lineTo(cx, cy + r * 0.6);
      ctx.stroke();
      break;

    case LOOPComponent.FLIPPED:
      // Up-down arrows (vertical mirror)
      const vh = r * 0.8;
      // Up arrow
      ctx.beginPath();
      ctx.moveTo(cx, cy - vh);
      ctx.lineTo(cx, cy - vh * 0.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy - vh);
      ctx.lineTo(cx - size * 0.08, cy - vh + size * 0.1);
      ctx.moveTo(cx, cy - vh);
      ctx.lineTo(cx + size * 0.08, cy - vh + size * 0.1);
      ctx.stroke();
      // Down arrow
      ctx.beginPath();
      ctx.moveTo(cx, cy + vh);
      ctx.lineTo(cx, cy + vh * 0.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy + vh);
      ctx.lineTo(cx - size * 0.08, cy + vh - size * 0.1);
      ctx.moveTo(cx, cy + vh);
      ctx.lineTo(cx + size * 0.08, cy + vh - size * 0.1);
      ctx.stroke();
      // Center line
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.6, cy);
      ctx.lineTo(cx + r * 0.6, cy);
      ctx.stroke();
      break;

    case LOOPComponent.SWAPPED:
      // Shuffle/crossing arrows
      const sw = r * 0.7;
      ctx.beginPath();
      // Top-left to bottom-right
      ctx.moveTo(cx - sw, cy - sw * 0.5);
      ctx.lineTo(cx + sw, cy + sw * 0.5);
      ctx.stroke();
      // Bottom-left to top-right
      ctx.beginPath();
      ctx.moveTo(cx - sw, cy + sw * 0.5);
      ctx.lineTo(cx + sw, cy - sw * 0.5);
      ctx.stroke();
      // Arrow heads on right side
      ctx.beginPath();
      ctx.moveTo(cx + sw, cy + sw * 0.5);
      ctx.lineTo(cx + sw - size * 0.1, cy + sw * 0.5 - size * 0.06);
      ctx.moveTo(cx + sw, cy - sw * 0.5);
      ctx.lineTo(cx + sw - size * 0.1, cy - sw * 0.5 + size * 0.06);
      ctx.stroke();
      break;

    case LOOPComponent.INVERTED:
      // Half-filled circle (adjust icon)
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.85, 0, 2 * Math.PI);
      ctx.stroke();
      // Fill left half
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.85, Math.PI * 0.5, Math.PI * 1.5);
      ctx.fill();
      break;

    case LOOPComponent.REWOUND:
      // Backward arrows (rewind symbol)
      const rw = r * 0.5;
      // First triangle (left)
      ctx.beginPath();
      ctx.moveTo(cx - rw * 0.1, cy - rw);
      ctx.lineTo(cx - rw * 1.2, cy);
      ctx.lineTo(cx - rw * 0.1, cy + rw);
      ctx.closePath();
      ctx.fill();
      // Second triangle (right)
      ctx.beginPath();
      ctx.moveTo(cx + rw * 0.9, cy - rw);
      ctx.lineTo(cx - rw * 0.2, cy);
      ctx.lineTo(cx + rw * 0.9, cy + rw);
      ctx.closePath();
      ctx.fill();
      break;
  }
}

/**
 * Render LOOP badges - individual icon badges for each active LOOP component
 *
 * Design:
 * - Each active component rendered as a colored badge with icon
 * - Badges arranged in a horizontal row
 * - Right-aligned in the header
 *
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
