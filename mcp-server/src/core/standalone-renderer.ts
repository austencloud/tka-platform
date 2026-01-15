/**
 * Standalone Pictograph Renderer - Node.js Implementation
 *
 * A properly-implemented renderer that uses the same calculation logic
 * as the Canvas2D browser renderer to achieve pixel-perfect parity.
 *
 * This replaces the half-assed StandalonePictographRenderer.ts that had
 * completely wrong position/rotation calculations.
 */

import { Resvg } from "@resvg/resvg-js";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import {
  GridLocation,
  GridMode,
  MotionType,
  Orientation,
  type PropColor,
} from "./enums.js";
import { calculatePropPlacement } from "./prop-placement.js";
import { calculateArrowPlacement } from "./arrow-placement.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// CONSTANTS (matching Canvas2DDirectRenderer.ts exactly)
// ============================================================================

const VIEWBOX_SIZE = 950;
const CENTER = VIEWBOX_SIZE / 2; // 475

// Colors (matching the real renderer)
const BLUE_COLOR = "#2E77AE";
const RED_COLOR = "#ED1C24";
const BLUE_COLOR_LIGHT = "#1a4a6e";
const RED_COLOR_LIGHT = "#a31018";

// Glyph positioning (matching real renderer)
const TKA_GLYPH_X = 50;
const TKA_GLYPH_Y = 800;

const VTG_GLYPH_WIDTH = 201.24;
const VTG_GLYPH_HEIGHT = 133.6;
const VTG_OFFSET_PERCENTAGE = 0.04;

const POSITION_GLYPH_Y = 50;
const POSITION_SCALE_FACTOR = 0.75;
const POSITION_SPACING = 25;
const POSITION_ARROW_WIDTH = 88.9;
const POSITION_ARROW_HEIGHT = 34.8;

// Position letter dimensions (from actual SVG viewBoxes)
const POSITION_LETTER_DIMENSIONS: Record<string, { width: number; height: number; yOffset: number }> = {
  alpha: { width: 92.22, height: 100, yOffset: 10.0 },
  beta: { width: 66.05, height: 100, yOffset: 0.0 },
  gamma: { width: 79, height: 100.11, yOffset: 0.0 },
};

// VTG mode lookup tables
type VTGMode = "SS" | "SO" | "TS" | "TO" | "QS" | "QO";
const DIAMOND_VTG_MAP: Record<string, VTGMode | ((startPos: string) => VTGMode)> = {
  A: "SS", B: "SS", C: "SS",
  D: (startPos) => ["beta3", "beta7"].includes(startPos.toLowerCase()) ? "SO" : "TO",
  E: (startPos) => ["beta3", "beta7"].includes(startPos.toLowerCase()) ? "SO" : "TO",
  F: (startPos) => ["beta3", "beta7"].includes(startPos.toLowerCase()) ? "SO" : "TO",
  G: "TS", H: "TS", I: "TS",
  J: (startPos) => ["alpha1", "alpha5"].includes(startPos.toLowerCase()) ? "SO" : "TO",
  K: (startPos) => ["alpha1", "alpha5"].includes(startPos.toLowerCase()) ? "SO" : "TO",
  L: (startPos) => ["alpha1", "alpha5"].includes(startPos.toLowerCase()) ? "SO" : "TO",
  M: "QO", N: "QO", O: "QO", P: "QO", Q: "QO", R: "QO",
  S: "QS", T: "QS", U: "QS", V: "QS",
};

// ============================================================================
// INTERFACES
// ============================================================================

export interface MotionInput {
  motionType: string;
  rotationDirection: string;
  startLocation: string;
  endLocation: string;
  startOrientation?: string;
  endOrientation?: string;
  color: string;
}

export interface PictographInput {
  letter: string;
  startPosition?: string;
  endPosition?: string;
  blueMotion: MotionInput;
  redMotion: MotionInput;
  gridMode?: string;
}

export interface RenderVisibilityOptions {
  darkMode?: boolean;
  size?: number;
  showTKA?: boolean;
  showVTG?: boolean;
  showPositions?: boolean;
  showReversals?: boolean;
  showGrid?: boolean;
  showNonRadialPoints?: boolean;
  showBlueMotion?: boolean;
  showRedMotion?: boolean;
}

// ============================================================================
// RENDERER CLASS
// ============================================================================

export class StandaloneRenderer {
  private projectRoot: string;

  constructor() {
    // MCP server runs from mcp-server/src/core, go up to project root
    this.projectRoot = join(__dirname, "../../..");
  }

  /**
   * Render a pictograph to PNG buffer
   */
  async renderToPng(input: PictographInput, options: RenderVisibilityOptions = {}): Promise<Buffer> {
    const svg = await this.renderToSvg(input, options);
    return this.svgToPng(svg, options.size || 400);
  }

  /**
   * Render to base64-encoded PNG
   */
  async renderToBase64(input: PictographInput, options: RenderVisibilityOptions = {}): Promise<string> {
    const png = await this.renderToPng(input, options);
    return png.toString("base64");
  }

  /**
   * Render a pictograph to SVG string
   */
  async renderToSvg(input: PictographInput, options: RenderVisibilityOptions = {}): Promise<string> {
    const {
      darkMode = true,
      showTKA = true,
      showVTG = false,
      showPositions = false,
      showGrid = true,
      showBlueMotion = true,
      showRedMotion = true,
    } = options;

    const gridMode = this.parseGridMode(input.gridMode);
    const svgParts: string[] = [];

    // 1. Background
    const bgColor = darkMode ? "#0a0a0f" : "#ffffff";
    svgParts.push(`<rect width="${VIEWBOX_SIZE}" height="${VIEWBOX_SIZE}" fill="${bgColor}"/>`);

    // 2. Grid
    if (showGrid) {
      const gridSvg = this.renderGrid(darkMode);
      if (gridSvg) svgParts.push(gridSvg);
    }

    // 3. Props (using CORRECT placement logic)
    if (showBlueMotion) {
      const blueProp = this.renderProp(input.blueMotion, gridMode, darkMode);
      if (blueProp) svgParts.push(blueProp);
    }
    if (showRedMotion) {
      const redProp = this.renderProp(input.redMotion, gridMode, darkMode);
      if (redProp) svgParts.push(redProp);
    }

    // 4. Arrows (using CORRECT placement logic)
    if (showBlueMotion) {
      const blueArrow = this.renderArrow(input.blueMotion, gridMode, darkMode);
      if (blueArrow) svgParts.push(blueArrow);
    }
    if (showRedMotion) {
      const redArrow = this.renderArrow(input.redMotion, gridMode, darkMode);
      if (redArrow) svgParts.push(redArrow);
    }

    // 5. Position glyph (top center)
    if (showPositions && input.startPosition && input.endPosition) {
      const positionSvg = this.renderPositionGlyph(input.startPosition, input.endPosition, darkMode);
      if (positionSvg) svgParts.push(positionSvg);
    }

    // 6. TKA Letter glyph (bottom left)
    if (showTKA && input.letter) {
      const letterSvg = this.renderLetter(input.letter, darkMode);
      if (letterSvg) svgParts.push(letterSvg);
    }

    // 7. VTG glyph (bottom right)
    if (showVTG && input.letter && input.startPosition) {
      const vtgSvg = this.renderVTGGlyph(input.letter, input.startPosition, darkMode);
      if (vtgSvg) svgParts.push(vtgSvg);
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}" width="${VIEWBOX_SIZE}" height="${VIEWBOX_SIZE}">
${svgParts.join("\n")}
</svg>`;
  }

  // ==========================================================================
  // GRID RENDERING
  // ==========================================================================

  private renderGrid(darkMode: boolean): string {
    const gridPath = join(this.projectRoot, "static/images/grid/diamond_grid.svg");

    if (!existsSync(gridPath)) {
      console.error("[Renderer] Grid file not found:", gridPath);
      return "";
    }

    try {
      let gridSvg = readFileSync(gridPath, "utf-8");

      // Extract inner content
      const innerMatch = gridSvg.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
      let innerContent = innerMatch ? innerMatch[1] : gridSvg;

      // Apply color transform for dark/light mode
      if (darkMode) {
        innerContent = innerContent.replace(/#000000/gi, "#d0d0d0");
        innerContent = innerContent.replace(/black/gi, "#d0d0d0");
        return `<g opacity="0.85">${innerContent}</g>`;
      } else {
        return `<g opacity="0.7">${innerContent}</g>`;
      }
    } catch (error) {
      console.error("[Renderer] Failed to load grid:", error);
      return "";
    }
  }

  // ==========================================================================
  // PROP RENDERING (USING CORRECT PLACEMENT)
  // ==========================================================================

  private renderProp(motion: MotionInput, gridMode: GridMode, darkMode: boolean): string {
    // Get the end location and orientation
    const endLocation = motion.endLocation.toLowerCase() as GridLocation;
    const endOrientation = (motion.endOrientation || Orientation.IN).toLowerCase() as Orientation;

    // Use the CORRECTLY PORTED placement calculation
    const placement = calculatePropPlacement(endLocation, endOrientation, gridMode);

    // Load the prop SVG
    const propPath = join(this.projectRoot, "static/images/props/staff.svg");
    if (!existsSync(propPath)) {
      console.error("[Renderer] Prop file not found:", propPath);
      return "";
    }

    try {
      let propSvg = readFileSync(propPath, "utf-8");

      // Get viewBox dimensions
      const viewBoxMatch = propSvg.match(/viewBox\s*=\s*"([^"]+)"/i);
      let width = 100, height = 100;
      if (viewBoxMatch) {
        const parts = viewBoxMatch[1].split(/\s+/).map(parseFloat);
        width = parts[2] || 100;
        height = parts[3] || 100;
      }

      // Extract inner content
      const innerMatch = propSvg.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
      let innerContent = innerMatch ? innerMatch[1] : propSvg;

      // Apply color - replace any existing fill colors with the prop color
      // Staff SVG uses #2e3192 as its base color
      const color = motion.color === "blue"
        ? (darkMode ? BLUE_COLOR : BLUE_COLOR_LIGHT)
        : (darkMode ? RED_COLOR : RED_COLOR_LIGHT);

      innerContent = innerContent.replace(/#000000/gi, color);
      innerContent = innerContent.replace(/black/gi, color);
      innerContent = innerContent.replace(/#2e3192/gi, color); // Staff/arrow base color
      innerContent = innerContent.replace(/#00f/gi, color); // Center point marker

      // The prop's center point is at the middle of its viewBox
      const centerX = width / 2;
      const centerY = height / 2;

      // Canvas2D renderer draws props at their FULL viewBox dimensions
      // within the 950x950 scene - NO additional scaling
      // Transform: translate to position → rotate → translate by -center
      return `<g transform="translate(${placement.x}, ${placement.y}) rotate(${placement.rotation}) translate(${-centerX}, ${-centerY})">
  ${innerContent}
</g>`;
    } catch (error) {
      console.error("[Renderer] Failed to load prop:", error);
      return "";
    }
  }

  // ==========================================================================
  // ARROW RENDERING (USING CORRECT PLACEMENT)
  // ==========================================================================

  private renderArrow(motion: MotionInput, gridMode: GridMode, darkMode: boolean): string {
    const motionType = motion.motionType.toLowerCase();

    // Static motions don't have arrows
    if (motionType === "static") {
      return "";
    }

    const startLocation = motion.startLocation.toLowerCase() as GridLocation;
    const endLocation = motion.endLocation.toLowerCase() as GridLocation;
    const startOrientation = motion.startOrientation?.toLowerCase() as Orientation | undefined;

    // Check if orientation is radial (IN/OUT vs CLOCK/COUNTER)
    const isRadialOrientation = startOrientation === Orientation.IN || startOrientation === Orientation.OUT;

    // Use the CORRECTLY PORTED placement calculation
    const placement = calculateArrowPlacement(
      motionType as MotionType,
      startLocation,
      endLocation,
      motion.rotationDirection,
      gridMode,
      isRadialOrientation
    );

    // Determine arrow file path based on motion type
    const arrowPath = this.getArrowPath(motionType, startLocation);
    if (!arrowPath || !existsSync(arrowPath)) {
      console.error("[Renderer] Arrow file not found:", arrowPath);
      return "";
    }

    try {
      let arrowSvg = readFileSync(arrowPath, "utf-8");

      // Get viewBox dimensions
      const viewBoxMatch = arrowSvg.match(/viewBox\s*=\s*"([^"]+)"/i);
      let width = 100, height = 100;
      if (viewBoxMatch) {
        const parts = viewBoxMatch[1].split(/\s+/).map(parseFloat);
        width = Math.abs(parts[2]) || 100;
        height = Math.abs(parts[3]) || 100;
      }

      // Extract inner content
      const innerMatch = arrowSvg.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
      let innerContent = innerMatch ? innerMatch[1] : arrowSvg;

      // Apply color - replace any existing fill colors with the arrow color
      // Arrow SVGs use #2e3192 as their base color
      const color = motion.color === "blue"
        ? (darkMode ? BLUE_COLOR : BLUE_COLOR_LIGHT)
        : (darkMode ? RED_COLOR : RED_COLOR_LIGHT);

      innerContent = innerContent.replace(/#000000/gi, color);
      innerContent = innerContent.replace(/black/gi, color);
      innerContent = innerContent.replace(/#2e3192/gi, color); // Arrow base color

      const centerX = width / 2;
      const centerY = height / 2;

      // Canvas2D renderer draws arrows at their FULL viewBox dimensions
      // within the 950x950 scene - NO additional scaling
      // Transform: translate to position → rotate → translate by -center
      return `<g transform="translate(${placement.x}, ${placement.y}) rotate(${placement.rotation}) translate(${-centerX}, ${-centerY})">
  ${innerContent}
</g>`;
    } catch (error) {
      console.error("[Renderer] Failed to load arrow:", error);
      return "";
    }
  }

  private getArrowPath(motionType: string, startLocation: GridLocation): string {
    const isRadial = ["n", "e", "s", "w"].includes(startLocation);
    const startType = isRadial ? "from_radial" : "from_nonradial";

    if (motionType === "dash") {
      return join(this.projectRoot, "static/images/arrows/dash.svg");
    }

    // For pro/anti, use the from_radial/from_nonradial structure
    return join(
      this.projectRoot,
      "static/images/arrows",
      motionType,
      startType,
      `${motionType}_1.0.svg`
    );
  }

  // ==========================================================================
  // GLYPH RENDERING
  // ==========================================================================

  private renderLetter(letter: string, darkMode: boolean): string {
    // Map Greek letters to file names
    const letterMap: Record<string, string> = {
      α: "α", β: "β", γ: "γ",
      Γ: "Γ", Δ: "Δ", Θ: "Θ",
      Λ: "Λ", Σ: "Σ", Φ: "Φ",
      Ψ: "Ψ", Ω: "Ω",
    };

    const fileName = letterMap[letter] || letter;
    // Correct path: letters_trimmed/Type1, not letters/Type1
    const letterPath = join(this.projectRoot, "static/images/letters_trimmed/Type1", `${fileName}.svg`);

    if (!existsSync(letterPath)) {
      // Fallback to text (but this shouldn't happen for valid letters)
      const textColor = darkMode ? "#e6e6e6" : "#000000";
      return `<text x="${TKA_GLYPH_X}" y="${TKA_GLYPH_Y + 80}" font-family="Georgia, serif" font-size="100" font-weight="bold" fill="${textColor}">${letter}</text>`;
    }

    try {
      let letterSvg = readFileSync(letterPath, "utf-8");

      // Get the FULL viewBox - including any offset (critical for trimmed letters)
      // Letter A has viewBox="22.48 0 74.98 99.96" - we must preserve the 22.48 offset
      const viewBoxMatch = letterSvg.match(/viewBox\s*=\s*"([^"]+)"/i);
      let viewBox = "0 0 100 100";
      let width = 100, height = 100;
      if (viewBoxMatch) {
        viewBox = viewBoxMatch[1];
        const parts = viewBox.split(/\s+/).map(parseFloat);
        // parts = [minX, minY, width, height]
        width = parts[2] || 100;
        height = parts[3] || 100;
      }

      // Extract inner content
      const innerMatch = letterSvg.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
      let innerContent = innerMatch ? innerMatch[1] : letterSvg;

      // Apply dark mode color
      if (darkMode) {
        innerContent = innerContent.replace(/#000000/gi, "#e6e6e6");
        innerContent = innerContent.replace(/black/gi, "#e6e6e6");
      }

      // Use the ORIGINAL viewBox to preserve the offset coordinates
      return `<g transform="translate(${TKA_GLYPH_X}, ${TKA_GLYPH_Y})">
  <svg width="${width}" height="${height}" viewBox="${viewBox}">
    ${innerContent}
  </svg>
</g>`;
    } catch (error) {
      console.error("[Renderer] Failed to load letter:", error);
      const textColor = darkMode ? "#e6e6e6" : "#000000";
      return `<text x="${TKA_GLYPH_X}" y="${TKA_GLYPH_Y + 80}" font-family="Georgia, serif" font-size="100" font-weight="bold" fill="${textColor}">${letter}</text>`;
    }
  }

  private renderVTGGlyph(letter: string, startPosition: string, darkMode: boolean): string {
    const vtgMode = this.calculateVTGMode(letter, startPosition);
    if (!vtgMode) return "";

    const vtgPath = join(this.projectRoot, "static/images/vtg_glyphs", `${vtgMode}.svg`);
    if (!existsSync(vtgPath)) {
      console.error("[Renderer] VTG glyph not found:", vtgPath);
      return "";
    }

    try {
      let vtgSvg = readFileSync(vtgPath, "utf-8");

      // Extract inner content
      const innerMatch = vtgSvg.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
      let innerContent = innerMatch ? innerMatch[1] : vtgSvg;

      // Apply dark mode color
      if (darkMode) {
        innerContent = innerContent.replace(/#000000/gi, "#e6e6e6");
        innerContent = innerContent.replace(/black/gi, "#e6e6e6");
      }

      // Position in bottom-right corner
      const offsetWidth = VIEWBOX_SIZE * VTG_OFFSET_PERCENTAGE;
      const offsetHeight = VIEWBOX_SIZE * VTG_OFFSET_PERCENTAGE;
      const xPosition = VIEWBOX_SIZE - VTG_GLYPH_WIDTH - offsetWidth;
      const yPosition = VIEWBOX_SIZE - VTG_GLYPH_HEIGHT - offsetHeight;

      return `<g transform="translate(${xPosition}, ${yPosition})">
  <svg width="${VTG_GLYPH_WIDTH}" height="${VTG_GLYPH_HEIGHT}" viewBox="0 0 201.24 133.6">
    ${innerContent}
  </svg>
</g>`;
    } catch (error) {
      console.error("[Renderer] Failed to load VTG glyph:", error);
      return "";
    }
  }

  private renderPositionGlyph(startPosition: string, endPosition: string, darkMode: boolean): string {
    const startGroup = this.extractPositionGroup(startPosition);
    const endGroup = this.extractPositionGroup(endPosition);

    if (!startGroup || !endGroup) return "";

    const groupToSvg: Record<string, string> = {
      alpha: "α.svg",
      beta: "β.svg",
      gamma: "γ.svg",
    };

    const startFileName = groupToSvg[startGroup];
    const endFileName = groupToSvg[endGroup];

    if (!startFileName || !endFileName) return "";

    const startPath = join(this.projectRoot, "static/images/letters_trimmed/Type6", startFileName);
    const endPath = join(this.projectRoot, "static/images/letters_trimmed/Type6", endFileName);
    const arrowPath = join(this.projectRoot, "static/images/arrow.svg");

    if (!existsSync(startPath) || !existsSync(endPath) || !existsSync(arrowPath)) {
      console.error("[Renderer] Position glyph files not found");
      return "";
    }

    try {
      const loadAndProcess = (filePath: string): string => {
        let svg = readFileSync(filePath, "utf-8");
        const innerMatch = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
        let content = innerMatch ? innerMatch[1] : svg;

        if (darkMode) {
          content = content.replace(/#000000/gi, "#e6e6e6");
          content = content.replace(/black/gi, "#e6e6e6");
        }
        return content;
      };

      const startContent = loadAndProcess(startPath);
      const endContent = loadAndProcess(endPath);
      const arrowContent = loadAndProcess(arrowPath);

      // Calculate dimensions
      const scaledLetterWidth = 92.22 * POSITION_SCALE_FACTOR;
      const scaledLetterHeight = 100 * POSITION_SCALE_FACTOR;
      const scaledArrowWidth = POSITION_ARROW_WIDTH * POSITION_SCALE_FACTOR;
      const scaledArrowHeight = POSITION_ARROW_HEIGHT * POSITION_SCALE_FACTOR;

      // Calculate positions
      const centerLine = scaledLetterHeight / 2;
      const startX = 0;
      const startY = centerLine - scaledLetterHeight / 2;
      const arrowX = scaledLetterWidth + POSITION_SPACING * POSITION_SCALE_FACTOR;
      const arrowY = centerLine - scaledArrowHeight / 2;
      const endX = scaledLetterWidth + scaledArrowWidth + POSITION_SPACING;
      const endY = centerLine - scaledLetterHeight / 2;

      // Total width for centering
      const totalWidth = scaledLetterWidth + scaledArrowWidth + scaledLetterWidth + POSITION_SPACING;
      const groupX = VIEWBOX_SIZE / 2 - totalWidth / 2;

      return `<g transform="translate(${groupX}, ${POSITION_GLYPH_Y})">
  <svg x="${startX}" y="${startY}" width="${scaledLetterWidth}" height="${scaledLetterHeight}" viewBox="0 0 92.22 100">
    ${startContent}
  </svg>
  <svg x="${arrowX}" y="${arrowY}" width="${scaledArrowWidth}" height="${scaledArrowHeight}" viewBox="0 0 ${POSITION_ARROW_WIDTH} ${POSITION_ARROW_HEIGHT}">
    ${arrowContent}
  </svg>
  <svg x="${endX}" y="${endY}" width="${scaledLetterWidth}" height="${scaledLetterHeight}" viewBox="0 0 92.22 100">
    ${endContent}
  </svg>
</g>`;
    } catch (error) {
      console.error("[Renderer] Failed to render position glyph:", error);
      return "";
    }
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private parseGridMode(gridMode?: string): GridMode {
    if (!gridMode) return GridMode.DIAMOND;
    const normalized = gridMode.toLowerCase();
    if (normalized === "box") return GridMode.BOX;
    if (normalized === "skewed") return GridMode.SKEWED;
    return GridMode.DIAMOND;
  }

  private calculateVTGMode(letter: string, startPosition: string): VTGMode | null {
    const letterUpper = letter.toUpperCase();
    if (letterUpper.length !== 1 || letterUpper < "A" || letterUpper > "V") {
      return null;
    }

    const modeOrFunction = DIAMOND_VTG_MAP[letterUpper];
    if (!modeOrFunction) return null;

    if (typeof modeOrFunction === "function") {
      return modeOrFunction(startPosition);
    }
    return modeOrFunction;
  }

  private extractPositionGroup(position: string): string | null {
    const match = position.match(/[a-z]+/i);
    return match ? match[0].toLowerCase() : null;
  }

  private svgToPng(svg: string, size: number): Buffer {
    const resvg = new Resvg(svg, {
      fitTo: {
        mode: "width",
        value: size,
      },
      font: {
        loadSystemFonts: true,
      },
    });

    const pngData = resvg.render();
    return Buffer.from(pngData.asPng());
  }
}

// Singleton instance
let rendererInstance: StandaloneRenderer | null = null;

export function getStandaloneRenderer(): StandaloneRenderer {
  if (!rendererInstance) {
    rendererInstance = new StandaloneRenderer();
  }
  return rendererInstance;
}
