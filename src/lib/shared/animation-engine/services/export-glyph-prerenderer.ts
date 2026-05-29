/**
 * Export Glyph Prerenderer
 *
 * Pre-renders complete TKA glyphs (letter + dash + turns column) as composite
 * HTMLImageElements before the export frame loop. Each unique combination of
 * letter, turns tuple, and turn colors produces one cached image.
 *
 * This ensures the exported video matches the live canvas exactly - the live
 * canvas renders TKAGlyph + Dash + TurnsColumn as SVG overlays; without
 * pre-rendering, the export would only show a bare letter SVG.
 */

import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
import type { SvgImageConverter } from '$lib/shared/foundation/services/svg-image-converter'

export interface GlyphAsset {
  image: HTMLImageElement;
  dimensions: { width: number; height: number };
  /** Pixels the image extends above the standard glyph origin (50, 800).
   *  When turns are present, the top turn number sits above the letter. */
  yOffset: number;
}
import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import { TurnsTupleGenerator } from "$lib/shared/pictograph/arrow/positioning/placement/services/turns-tuple-generator";
import { interpretTurnColors } from "$lib/shared/pictograph/tka-glyph/services/turn-color-interpreter";
import {
  getLetterImagePath,
  isDashLetter,
} from "$lib/shared/pictograph/tka-glyph/utils/letter-image-getter";
import {
  parseTurnsTuple,
  shouldDisplayTurn,
  getTurnNumberImagePath,
  getTurnNumberWidth,
} from "$lib/shared/pictograph/tka-glyph/utils/turn-tuple-parser";
import { calculateTurnPositions } from "$lib/shared/pictograph/tka-glyph/utils/turn-position-calculator";

// Constants matching Dash.svelte
const DASH_WIDTH = 70;
const DASH_HEIGHT = 20;
const DASH_GAP = 10;
const DASH_FILL = "#231f20";

// Turn number height (constant across all number SVGs)
const NUMBER_HEIGHT = 45;

// Padding above the letter origin to accommodate the top turn number
const TURN_Y_PADDING = 5;

// Mode-specific colors for turn numbers.
// Must match TurnsColumn.svelte STATIC_COLORS and MOTION_COLOR_MAP in svg-color-utils.ts.
const TURN_COLORS = {
  dark: { blue: "#3575E2", red: "#ED1C24" },
  light: { blue: "#3D44B8", red: "#DC2626" },
} as const;

// TurnColorInterpreter always returns "dark" mode hex values.
// Use these to identify which hand (blue vs red) a returned color represents.
const INTERPRETER_BLUE_HEX = "#3575E2";

interface GlyphBuildData {
  letter: string;
  turnsTuple: string;
  topColor: string;
  bottomColor: string;
  step: StepData;
}

export class ExportGlyphPrerenderer {
  private cache = new Map<string, GlyphAsset>();
  private stepKeyMap = new Map<number, string>();
  private tupleGenerator = new TurnsTupleGenerator();

  constructor(private readonly svgImageConverter: SvgImageConverter) {}

  async prerenderGlyphs(
    steps: readonly StepData[],
    isDarkMode: boolean
  ): Promise<void> {
    this.clear();

    // Phase 1: Compute cache keys for each step, collect unique glyph specs
    const uniqueGlyphs = new Map<string, GlyphBuildData>();

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]!;
      if (!step.letter) continue;

      const turnsTuple = this.tupleGenerator.generateTurnsTuple(step);
      const interpreterColors = interpretTurnColors(
        step.letter,
        step
      );

      // Map interpreter colors (always dark mode) to the correct export colors
      const topColor = this.resolveExportColor(
        interpreterColors.top,
        isDarkMode
      );
      const bottomColor = this.resolveExportColor(
        interpreterColors.bottom,
        isDarkMode
      );

      const key = `${step.letter}|${turnsTuple}|${topColor}|${bottomColor}`;
      this.stepKeyMap.set(i, key);

      if (!uniqueGlyphs.has(key)) {
        uniqueGlyphs.set(key, {
          letter: step.letter,
          turnsTuple,
          topColor,
          bottomColor,
          step,
        });
      }
    }

    // Phase 2: Fetch all unique SVG resources in parallel
    const svgTextCache = new Map<string, string>();
    const svgDimsCache = new Map<
      string,
      { minX: number; minY: number; width: number; height: number }
    >();

    const uniqueLetters = new Set<string>();
    const uniqueTurnPaths = new Set<string>();

    for (const { letter, turnsTuple } of uniqueGlyphs.values()) {
      uniqueLetters.add(letter);
      const parsed = parseTurnsTuple(turnsTuple);
      if (shouldDisplayTurn(parsed.top))
        uniqueTurnPaths.add(getTurnNumberImagePath(parsed.top));
      if (shouldDisplayTurn(parsed.bottom))
        uniqueTurnPaths.add(getTurnNumberImagePath(parsed.bottom));
    }

    const fetchPromises: Promise<void>[] = [];

    for (const letter of uniqueLetters) {
      const path = getLetterImagePath(letter as Letter);
      fetchPromises.push(
        this.fetchAndCacheSvg(path, svgTextCache, svgDimsCache)
      );
    }

    for (const turnPath of uniqueTurnPaths) {
      if (!turnPath) continue;
      fetchPromises.push(
        this.fetchAndCacheSvg(turnPath, svgTextCache, svgDimsCache)
      );
    }

    await Promise.all(fetchPromises);

    // Phase 3: Build composite SVGs and convert to images
    const renderPromises: Promise<void>[] = [];

    for (const [key, data] of uniqueGlyphs) {
      renderPromises.push(
        this.buildAndCacheGlyph(
          key,
          data,
          isDarkMode,
          svgTextCache,
          svgDimsCache
        )
      );
    }

    await Promise.all(renderPromises);
  }

  getGlyph(cacheKey: string): GlyphAsset | null {
    return this.cache.get(cacheKey) ?? null;
  }

  getCacheKeyForStep(stepIndex: number): string {
    return this.stepKeyMap.get(stepIndex) ?? "";
  }

  clear(): void {
    this.cache.clear();
    this.stepKeyMap.clear();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Map TurnColorInterpreter output (always dark-mode hex) to the correct
   * export color based on the actual dark/light mode.
   */
  private resolveExportColor(
    interpreterColor: string,
    isDarkMode: boolean
  ): string {
    const isBlue =
      interpreterColor.toLowerCase() === INTERPRETER_BLUE_HEX.toLowerCase();
    const palette = isDarkMode ? TURN_COLORS.dark : TURN_COLORS.light;
    return isBlue ? palette.blue : palette.red;
  }

  /**
   * Fetch an SVG file and cache its text + viewBox dimensions.
   */
  private async fetchAndCacheSvg(
    path: string,
    textCache: Map<string, string>,
    dimsCache: Map<
      string,
      { minX: number; minY: number; width: number; height: number }
    >
  ): Promise<void> {
    if (textCache.has(path)) return;
    try {
      const response = await fetch(path);
      if (!response.ok) return;
      const text = await response.text();
      textCache.set(path, text);

      const match = text.match(
        /viewBox\s*=\s*"([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)"/i
      );
      dimsCache.set(path, {
        minX: match ? parseFloat(match[1]!) : 0,
        minY: match ? parseFloat(match[2]!) : 0,
        width: match ? parseFloat(match[3]!) : 100,
        height: match ? parseFloat(match[4]!) : 100,
      });
    } catch {
      // Silently skip – missing SVGs will just not render
    }
  }

  /**
   * Build a composite SVG string for one glyph variant and convert to an image.
   */
  private async buildAndCacheGlyph(
    key: string,
    data: GlyphBuildData,
    isDarkMode: boolean,
    svgTextCache: Map<string, string>,
    svgDimsCache: Map<
      string,
      { minX: number; minY: number; width: number; height: number }
    >
  ): Promise<void> {
    const letterPath = getLetterImagePath(data.letter as Letter);
    const letterSvg = svgTextCache.get(letterPath);
    if (!letterSvg) return;

    const letterViewBox = svgDimsCache.get(letterPath) ?? {
      minX: 0,
      minY: 0,
      width: 100,
      height: 100,
    };
    const letterDims = {
      width: letterViewBox.width,
      height: letterViewBox.height,
    };

    const parsed = parseTurnsTuple(data.turnsTuple);
    const hasDash = isDashLetter(data.letter);
    const showTop = shouldDisplayTurn(parsed.top);
    const showBottom = shouldDisplayTurn(parsed.bottom);
    const hasTurns = showTop || showBottom;

    // Turn positions (relative to letter origin)
    const turnPositions = hasTurns
      ? calculateTurnPositions(letterDims, NUMBER_HEIGHT, hasDash)
      : null;

    const topWidth = showTop ? getTurnNumberWidth(parsed.top) : 0;
    const bottomWidth = showBottom ? getTurnNumberWidth(parsed.bottom) : 0;
    const columnWidth = Math.max(topWidth, bottomWidth);

    // Compute composite bounds
    let maxRight = letterDims.width;
    if (hasDash) maxRight = letterDims.width + DASH_GAP + DASH_WIDTH;
    if (hasTurns && turnPositions) {
      maxRight = Math.max(maxRight, turnPositions.top.x + columnWidth);
    }

    const yPadTop = hasTurns ? TURN_Y_PADDING : 0;
    const yPadBottom = hasTurns ? TURN_Y_PADDING : 0;
    const totalWidth = Math.ceil(maxRight);
    const totalHeight = Math.ceil(letterDims.height + yPadTop + yPadBottom);

    // -- Build composite SVG --------------------------------------------------

    const parts: string[] = [];
    parts.push(
      `<svg xmlns="http://www.w3.org/2000/svg" ` +
        `viewBox="0 0 ${totalWidth} ${totalHeight}" ` +
        `width="${totalWidth}" height="${totalHeight}">`
    );

    // Color filter definitions for turn numbers
    if (hasTurns) {
      parts.push("<defs>");
      parts.push(this.buildFeFloodFilter("top-color", data.topColor));
      parts.push(this.buildFeFloodFilter("bottom-color", data.bottomColor));
      parts.push("</defs>");
    }

    // --- Letter + Dash group (optionally inverted for dark mode) ---
    const invertAttr = isDarkMode ? ' style="filter: invert(0.9)"' : "";
    parts.push(`<g transform="translate(0, ${yPadTop})"${invertAttr}>`);

    // Inline the letter SVG content
    const letterContent = this.extractSvgInnerContent(letterSvg);
    // Account for non-zero viewBox origin
    const originTranslate =
      letterViewBox.minX !== 0 || letterViewBox.minY !== 0
        ? ` transform="translate(${-letterViewBox.minX}, ${-letterViewBox.minY})"`
        : "";
    parts.push(`<g${originTranslate}>${letterContent}</g>`);

    // Dash rect for Type3/Type5 letters
    if (hasDash) {
      const dashX = letterDims.width + DASH_GAP;
      const dashY = (letterDims.height - DASH_HEIGHT) / 2;
      parts.push(
        `<rect x="${dashX}" y="${dashY}" width="${DASH_WIDTH}" ` +
          `height="${DASH_HEIGHT}" rx="9.5" ry="9.5" fill="${DASH_FILL}"/>`
      );
    }

    parts.push("</g>"); // End letter+dash group

    // --- Turn numbers (NOT inside the dark-mode-inverted group) ---
    if (hasTurns && turnPositions) {
      if (showTop) {
        this.appendTurnNumber(
          parts,
          parsed.top,
          turnPositions.top.x,
          turnPositions.top.y + yPadTop,
          columnWidth,
          "top-color",
          svgTextCache,
          svgDimsCache
        );
      }
      if (showBottom) {
        this.appendTurnNumber(
          parts,
          parsed.bottom,
          turnPositions.bottom.x,
          turnPositions.bottom.y + yPadTop,
          columnWidth,
          "bottom-color",
          svgTextCache,
          svgDimsCache
        );
      }
    }

    parts.push("</svg>");

    const compositeSvg = parts.join("");

    try {
      const image = await this.svgImageConverter.convertSvgStringToImage(
        compositeSvg,
        totalWidth,
        totalHeight
      );
      this.cache.set(key, {
        image,
        dimensions: { width: totalWidth, height: totalHeight },
        yOffset: yPadTop,
      });
    } catch (err) {
      console.error(`Failed to prerender glyph for "${data.letter}":`, err);
    }
  }

  /**
   * Append an inlined turn number SVG element to the composite parts array.
   * Uses feFlood color filter and centers narrower numbers within columnWidth.
   */
  private appendTurnNumber(
    parts: string[],
    turnValue: number | "fl",
    x: number,
    y: number,
    columnWidth: number,
    filterId: string,
    svgTextCache: Map<string, string>,
    svgDimsCache: Map<
      string,
      { minX: number; minY: number; width: number; height: number }
    >
  ): void {
    const path = getTurnNumberImagePath(turnValue);
    const svg = svgTextCache.get(path);
    if (!svg) return;

    const viewBox = svgDimsCache.get(path) ?? {
      minX: 0,
      minY: 0,
      width: 30,
      height: 45,
    };
    const nativeWidth = getTurnNumberWidth(turnValue);

    // Center narrower numbers within columnWidth (matches preserveAspectRatio="xMidYMin meet")
    const xOffset = (columnWidth - nativeWidth) / 2;
    const content = this.extractSvgInnerContent(svg);

    const originTranslate =
      viewBox.minX !== 0 || viewBox.minY !== 0
        ? `translate(${-viewBox.minX}, ${-viewBox.minY}) `
        : "";

    parts.push(
      `<g transform="translate(${x + xOffset}, ${y})" filter="url(#${filterId})">`
    );
    parts.push(`<g${originTranslate ? ` transform="${originTranslate.trim()}"` : ""}>`);
    parts.push(content);
    parts.push("</g></g>");
  }

  /**
   * Build an SVG feFlood color filter that recolors content to a solid color.
   * Extracts the alpha channel and fills with the target color.
   */
  private buildFeFloodFilter(id: string, color: string): string {
    return (
      `<filter id="${id}" color-interpolation-filters="sRGB">` +
      `<feColorMatrix type="matrix" ` +
      `values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="a"/>` +
      `<feFlood flood-color="${color}" result="c"/>` +
      `<feComposite in="c" in2="a" operator="in"/>` +
      `</filter>`
    );
  }

  /**
   * Extract the inner content of an SVG document (everything inside <svg>...</svg>),
   * stripping the XML declaration and DOCTYPE if present.
   */
  private extractSvgInnerContent(svgText: string): string {
    const text = svgText
      .replace(/<\?xml[^?]*\?>\s*/gi, "")
      .replace(/<!DOCTYPE[^>]*>\s*/gi, "");
    const match = text.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
    return match ? match[1]!.trim() : "";
  }
}
