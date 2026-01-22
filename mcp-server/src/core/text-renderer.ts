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
 * Letter styling info for rendering the header with bridge letters grayed out
 */
export interface LetterStyle {
  letter: string;
  isBridge: boolean;
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

  // Render LOOP glyph in top-right corner (if provided)
  if (loopComponents && loopComponents.length > 0) {
    const glyphSize = badgeSize; // Same size as difficulty badge
    const glyphPadding = badgePadding;
    const glyphX = canvasWidth - glyphSize - glyphPadding;
    const glyphY = (headerHeight - glyphSize) / 2;
    renderLOOPGlyph(ctx, loopComponents, glyphX, glyphY, glyphSize, darkMode);
  }
}

/**
 * Render word with styled letters (bridge letters smaller and grayed out)
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

  // Bridge letters are 60% size and much more faded
  const primaryFontSize = fontSize;
  const bridgeFontSize = fontSize * 0.6;

  // Calculate total width to center the word (accounting for different sizes)
  let totalWidth = 0;
  for (const ls of letterStyles) {
    ctx.font = `bold ${ls.isBridge ? bridgeFontSize : primaryFontSize}px ${TITLE_FONT_FAMILY}`;
    totalWidth += ctx.measureText(ls.letter).width;
  }

  // Start position (centered)
  let x = (canvasWidth - totalWidth) / 2;

  // Colors - bridges are very faded (25% opacity)
  const primaryColor = darkMode ? "#ffffff" : "#1f2937";
  const bridgeColor = darkMode ? "rgba(255, 255, 255, 0.25)" : "rgba(31, 41, 55, 0.25)";

  // Render each letter
  ctx.textAlign = "left";
  for (const ls of letterStyles) {
    const currentFontSize = ls.isBridge ? bridgeFontSize : primaryFontSize;
    ctx.font = `bold ${currentFontSize}px ${TITLE_FONT_FAMILY}`;
    ctx.fillStyle = ls.isBridge ? bridgeColor : primaryColor;

    // Adjust Y position for smaller bridge letters to keep baseline aligned
    const yOffset = ls.isBridge ? (primaryFontSize - bridgeFontSize) * 0.15 : 0;
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
  const defaultNote = "Created with TKA Scribe";
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
  SWAPPED = "swapped",
  INVERTED = "inverted",
}

const LOOP_COMPONENT_COLORS: Record<LOOPComponent, string> = {
  [LOOPComponent.ROTATED]: "#36c3ff",   // Blue
  [LOOPComponent.MIRRORED]: "#6F2DA8", // Purple
  [LOOPComponent.SWAPPED]: "#26e600",  // Green
  [LOOPComponent.INVERTED]: "#eb7d00", // Orange
};

// Quadrant indices for each component (clockwise from top-right)
const LOOP_COMPONENT_QUADRANT: Record<LOOPComponent, number> = {
  [LOOPComponent.ROTATED]: 0,   // Top-right
  [LOOPComponent.MIRRORED]: 1,  // Bottom-right
  [LOOPComponent.SWAPPED]: 2,   // Bottom-left
  [LOOPComponent.INVERTED]: 3,  // Top-left
};

/**
 * Render LOOP glyph - a 4-quadrant pie chart showing which LOOP components are active
 *
 * Design:
 * - Circle divided into 4 quadrants
 * - Each quadrant represents a LOOP primitive
 * - Filled quadrant = component is active (colored)
 * - Empty quadrant = component is inactive (faded/gray)
 * - All empty = freeform sequence
 *
 * @param ctx Canvas 2D context
 * @param activeComponents Array of active LOOP components
 * @param x Left edge of glyph
 * @param y Top edge of glyph
 * @param size Diameter of the glyph
 * @param darkMode Whether to use dark theme
 */
export function renderLOOPGlyph(
  ctx: CanvasRenderingContext2D,
  activeComponents: LOOPComponent[],
  x: number,
  y: number,
  size: number,
  darkMode: boolean
): void {
  const centerX = x + size / 2;
  const centerY = y + size / 2;
  const radius = size / 2;

  // Create a set for O(1) lookup
  const activeSet = new Set(activeComponents);

  // Draw each quadrant
  const quadrantOrder: LOOPComponent[] = [
    LOOPComponent.ROTATED,   // 0: top-right
    LOOPComponent.MIRRORED,  // 1: bottom-right
    LOOPComponent.SWAPPED,   // 2: bottom-left
    LOOPComponent.INVERTED,  // 3: top-left
  ];

  for (let i = 0; i < 4; i++) {
    const component = quadrantOrder[i];
    if (!component) continue;

    const isActive = activeSet.has(component);

    // Calculate arc angles (starting from top, going clockwise)
    // Quadrant 0 (top-right): -90° to 0°
    // Quadrant 1 (bottom-right): 0° to 90°
    // Quadrant 2 (bottom-left): 90° to 180°
    // Quadrant 3 (top-left): 180° to 270° (-90°)
    const startAngle = (-Math.PI / 2) + (i * Math.PI / 2);
    const endAngle = startAngle + (Math.PI / 2);

    // Draw the quadrant
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.closePath();

    if (isActive) {
      // Filled with component color
      ctx.fillStyle = LOOP_COMPONENT_COLORS[component];
    } else {
      // Empty/inactive - very faded
      ctx.fillStyle = darkMode ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)";
    }
    ctx.fill();

    // Draw quadrant border
    ctx.strokeStyle = darkMode ? "rgba(255, 255, 255, 0.3)" : "rgba(0, 0, 0, 0.2)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Draw outer circle border for definition
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
  ctx.strokeStyle = darkMode ? "rgba(255, 255, 255, 0.5)" : "rgba(0, 0, 0, 0.3)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Draw cross lines through center for quadrant definition
  ctx.beginPath();
  ctx.moveTo(centerX, y);
  ctx.lineTo(centerX, y + size);
  ctx.moveTo(x, centerY);
  ctx.lineTo(x + size, centerY);
  ctx.strokeStyle = darkMode ? "rgba(255, 255, 255, 0.3)" : "rgba(0, 0, 0, 0.2)";
  ctx.lineWidth = 1;
  ctx.stroke();
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
