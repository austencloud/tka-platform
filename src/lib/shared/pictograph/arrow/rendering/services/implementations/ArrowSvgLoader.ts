/**
 * SVG Loading Service - SPRITE-BASED
 *
 * Loads arrows from a single sprite file containing all arrow symbols.
 * This eliminates 60+ individual HTTP requests in favor of one sprite load.
 *
 * Key features:
 * - Single sprite file load (cached)
 * - Symbol extraction by ID
 * - Multi-level caching (sprite + transformed by color/theme)
 * - HMR-aware cache persistence
 *
 * Extracted from ArrowRenderer to improve modularity and reusability.
 */

import type { IArrowPathResolver } from "../contracts/IArrowPathResolver";
import type { IArrowSvgParser } from "../contracts/IArrowSvgParser";
import type { ISvgColorTransformer } from "../contracts/IArrowSvgColorTransformer";
import type { ArrowPlacementData } from "../../../positioning/placement/domain/ArrowPlacementData";
import type { ArrowSvgData } from "../../../../shared/domain/models/svg-models";
import type {
  IArrowSvgLoader,
  ArrowSvgLoadOptions,
} from "../contracts/IArrowSvgLoader";
import type { MotionData } from "../../../../shared/domain/models/MotionData";
import { TYPES } from "../../../../../inversify/types";
import { inject, injectable } from "inversify";
import type { ThemeMode } from "../../../../../utils/svg-color-utils";
import { getAnimationVisibilityManager } from "../../../../../animation-engine/state/animation-visibility-state.svelte";
import { ARROW_SPRITE_PATH } from "./ArrowPathResolver";

// ============================================================================
// SYMBOL DATA STRUCTURE
// ============================================================================
interface SymbolData {
  viewBox: string;
  innerContent: string;
}

// ============================================================================
// CSS FILL INLINING UTILITIES
// ============================================================================

/**
 * Parse CSS style block to extract class->fill color mappings
 * e.g., ".st0{fill:#2E3192;}" -> { "st0": "#2E3192" }
 * Uses both DOM and regex fallback for maximum compatibility
 */
function parseStyleBlock(doc: Document, rawSvgText?: string): Map<string, string> {
  const classToFill = new Map<string, string>();
  const fillRegex = /\.([a-zA-Z0-9_-]+)\s*\{\s*fill\s*:\s*(#[0-9A-Fa-f]{3,6})\s*;?\s*\}/g;

  // Try DOM-based parsing first
  const styleElements = doc.querySelectorAll("style");
  styleElements.forEach((style) => {
    const cssText = style.textContent || "";
    let match;
    while ((match = fillRegex.exec(cssText)) !== null) {
      if (match[1] && match[2]) {
        classToFill.set(match[1], match[2]);
      }
    }
  });

  // Fallback: parse style from raw text if DOM parsing found nothing
  if (classToFill.size === 0 && rawSvgText) {
    const styleMatch = rawSvgText.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    if (styleMatch && styleMatch[1]) {
      const cssText = styleMatch[1];
      fillRegex.lastIndex = 0; // Reset regex state
      let match;
      while ((match = fillRegex.exec(cssText)) !== null) {
        if (match[1] && match[2]) {
          classToFill.set(match[1], match[2]);
        }
      }
    }
  }

  return classToFill;
}

/**
 * Inline CSS fill classes as direct fill attributes
 * Replaces class="st0" with fill="#2E3192" based on the style block mapping
 */
function inlineCssFills(content: string, classToFill: Map<string, string>): string {
  let result = content;

  classToFill.forEach((fillColor, className) => {
    // Replace class="className" with fill="color"
    const classRegex = new RegExp(`class="${className}"`, "g");
    result = result.replace(classRegex, `fill="${fillColor}"`);

    // Handle class='className' (single quotes)
    const classRegexSingle = new RegExp(`class='${className}'`, "g");
    result = result.replace(classRegexSingle, `fill="${fillColor}"`);
  });

  return result;
}

// ============================================================================
// HMR-AWARE MODULE-LEVEL CACHE STORAGE
// ============================================================================
const hmrSpriteCache: { symbols: Map<string, SymbolData>; loaded: boolean } =
  import.meta.hot?.data?.spriteCache ?? { symbols: new Map(), loaded: false };
const hmrTransformedSvgCache: Map<string, ArrowSvgData> =
  import.meta.hot?.data?.transformedSvgCache ?? new Map();

// Sprite update listeners (for components to re-render when sprite changes)
const spriteUpdateListeners: Set<() => void> =
  import.meta.hot?.data?.spriteUpdateListeners ?? new Set();

// Sprite version - increment on updates to trigger re-renders via callback
let spriteVersionInternal: number = import.meta.hot?.data?.spriteVersion ?? 0;

/** Get current sprite version - use with onSpriteUpdate callback for reactive updates */
export function getSpriteVersion(): number {
  return spriteVersionInternal;
}

// Persist caches before HMR disposal
if (import.meta.hot) {
  import.meta.hot.dispose((data) => {
    data.spriteCache = hmrSpriteCache;
    data.transformedSvgCache = hmrTransformedSvgCache;
    data.spriteUpdateListeners = spriteUpdateListeners;
    data.spriteVersion = spriteVersionInternal;
  });

  // Listen for sprite file changes from Vite plugin
  import.meta.hot.on("arrow-sprite-update", async () => {

    // Clear caches
    hmrSpriteCache.symbols.clear();
    hmrSpriteCache.loaded = false;
    hmrTransformedSvgCache.clear();

    // Helper to calculate viewBox from path bounds
    function getPathBounds(pathD: string): { minX: number; minY: number; maxX: number; maxY: number } {
      const numbers = pathD.match(/-?\d*\.?\d+/g) || [];
      const coords: number[] = numbers.map(Number);
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = 0; i < coords.length - 1; i += 2) {
        const x = coords[i] as number;
        const y = coords[i + 1] as number;
        if (!isNaN(x) && !isNaN(y)) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
      if (!isFinite(minX)) return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
      return { minX, minY, maxX, maxY };
    }

    function calculateGroupViewBox(group: Element): string {
      const dataViewBox = group.getAttribute("data-viewbox");
      if (dataViewBox) return dataViewBox;
      const paths = group.querySelectorAll("path");
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      paths.forEach((path) => {
        const d = path.getAttribute("d") || "";
        const bounds = getPathBounds(d);
        minX = Math.min(minX, bounds.minX);
        minY = Math.min(minY, bounds.minY);
        maxX = Math.max(maxX, bounds.maxX);
        maxY = Math.max(maxY, bounds.maxY);
      });
      const padding = 5;
      minX = Math.max(0, minX - padding);
      minY = Math.max(0, minY - padding);
      maxX = maxX + padding;
      maxY = maxY + padding;
      return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
    }

    // Reload sprite
    try {
      const response = await fetch(ARROW_SPRITE_PATH + `?t=${Date.now()}`);
      if (response.ok) {
        const spriteText = await response.text();
        const doc = new DOMParser().parseFromString(spriteText, "image/svg+xml");

        // Parse CSS style block to get class->fill mappings
        const classToFill = parseStyleBlock(doc, spriteText);

        // Try <symbol> first, then <g>
        const symbols = doc.querySelectorAll("symbol");
        if (symbols.length > 0) {
          symbols.forEach((symbol) => {
            const id = symbol.getAttribute("id");
            if (!id) return;
            const viewBox = symbol.getAttribute("viewBox") || "0 0 100 100";
            // Inline CSS fills so color transformation works
            const innerContent = inlineCssFills(symbol.innerHTML.trim(), classToFill);
            hmrSpriteCache.symbols.set(id, { viewBox, innerContent });
          });
        } else {
          const groups = doc.querySelectorAll("svg > g[id]");
          groups.forEach((group) => {
            const id = group.getAttribute("id");
            if (!id) return;
            const viewBox = calculateGroupViewBox(group);
            // Inline CSS fills so color transformation works
            const innerContent = inlineCssFills(group.innerHTML.trim(), classToFill);
            hmrSpriteCache.symbols.set(id, { viewBox, innerContent });
          });
        }

        hmrSpriteCache.loaded = true;

        // Increment version to trigger reactive updates
        spriteVersionInternal++;

        // Notify all listeners to re-render
        spriteUpdateListeners.forEach((callback) => callback());
      }
    } catch (error) {
      console.error("Failed to reload sprite:", error);
    }
  });
}

@injectable()
export class ArrowSvgLoader implements IArrowSvgLoader {
  // Sprite cache (single file containing all symbols)
  private spriteCache = hmrSpriteCache;
  private transformedSvgCache = hmrTransformedSvgCache;
  private spriteLoadPromise: Promise<void> | null = null;

  // Performance monitoring
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(
    @inject(TYPES.IArrowPathResolver) private pathResolver: IArrowPathResolver,
    @inject(TYPES.IArrowSvgParser) private svgParser: IArrowSvgParser,
    @inject(TYPES.IArrowSvgColorTransformer)
    private colorTransformer: ISvgColorTransformer
  ) {}

  /**
   * Calculate bounding box from an SVG path d attribute
   */
  private getPathBounds(pathD: string): { minX: number; minY: number; maxX: number; maxY: number } {
    const numbers = pathD.match(/-?\d*\.?\d+/g) || [];
    const coords: number[] = numbers.map(Number);

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (let i = 0; i < coords.length - 1; i += 2) {
      const x = coords[i] as number;
      const y = coords[i + 1] as number;
      if (!isNaN(x) && !isNaN(y)) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }

    if (!isFinite(minX)) return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    return { minX, minY, maxX, maxY };
  }

  /**
   * Calculate viewBox from a group element by examining its paths
   */
  private calculateGroupViewBox(group: Element): string {
    // First check for data-viewbox attribute
    const dataViewBox = group.getAttribute("data-viewbox");
    if (dataViewBox) return dataViewBox;

    // Calculate from path bounds
    const paths = group.querySelectorAll("path");
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    paths.forEach((path) => {
      const d = path.getAttribute("d") || "";
      const bounds = this.getPathBounds(d);
      minX = Math.min(minX, bounds.minX);
      minY = Math.min(minY, bounds.minY);
      maxX = Math.max(maxX, bounds.maxX);
      maxY = Math.max(maxY, bounds.maxY);
    });

    // Add padding
    const padding = 5;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = maxX + padding;
    maxY = maxY + padding;

    return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
  }

  /**
   * Get the current theme mode based on dark mode setting
   */
  private getCurrentThemeMode(): ThemeMode {
    try {
      const manager = getAnimationVisibilityManager();
      return manager.isDarkMode() ? "dark" : "light";
    } catch {
      return "light";
    }
  }

  /**
   * Load the sprite file and parse all symbols into cache
   * Handles both <symbol> (standard) and <g> (Illustrator export) formats
   */
  private async loadSprite(): Promise<void> {
    // Already loaded
    if (this.spriteCache.loaded) {
      return;
    }

    // Already loading - wait for it
    if (this.spriteLoadPromise) {
      return this.spriteLoadPromise;
    }

    // Start loading
    this.spriteLoadPromise = (async () => {
      try {
        const response = await fetch(ARROW_SPRITE_PATH);
        if (!response.ok) {
          throw new Error(`Failed to fetch sprite: ${response.status}`);
        }
        const spriteText = await response.text();

        // Parse the sprite
        const doc = new DOMParser().parseFromString(spriteText, "image/svg+xml");

        // Parse CSS style block to get class->fill mappings
        // This inlines fills like .st0{fill:#2E3192;} so color transformation works
        const classToFill = parseStyleBlock(doc, spriteText);

        // First try <symbol> elements (standard SVG sprite format)
        const symbols = doc.querySelectorAll("symbol");

        if (symbols.length > 0) {
          symbols.forEach((symbol) => {
            const id = symbol.getAttribute("id");
            if (!id) return;

            const viewBox = symbol.getAttribute("viewBox") || "0 0 100 100";
            // Inline CSS fills so color transformation works
            const innerContent = inlineCssFills(symbol.innerHTML.trim(), classToFill);

            this.spriteCache.symbols.set(id, { viewBox, innerContent });
          });
        } else {
          // Fallback to <g> elements (Illustrator export format)
          const groups = doc.querySelectorAll("svg > g[id]");

          groups.forEach((group) => {
            const id = group.getAttribute("id");
            if (!id) return;

            // Calculate viewBox from path bounds (or use data-viewbox if present)
            const viewBox = this.calculateGroupViewBox(group);
            // Inline CSS fills so color transformation works
            const innerContent = inlineCssFills(group.innerHTML.trim(), classToFill);

            this.spriteCache.symbols.set(id, { viewBox, innerContent });
          });
        }

        this.spriteCache.loaded = true;
      } catch (error) {
        console.error("Failed to load arrow sprite:", error);
        throw error;
      } finally {
        this.spriteLoadPromise = null;
      }
    })();

    return this.spriteLoadPromise;
  }

  /**
   * Get symbol data by ID from the cached sprite
   */
  private getSymbolData(symbolId: string): SymbolData | null {
    return this.spriteCache.symbols.get(symbolId) || null;
  }

  /**
   * Load arrow SVG data with color transformation
   */
  async loadArrowSvg(
    arrowData: ArrowPlacementData,
    motionData: MotionData,
    options?: ArrowSvgLoadOptions
  ): Promise<ArrowSvgData> {
    // Ensure sprite is loaded
    await this.loadSprite();

    // Get symbol ID from path resolver
    const symbolId = this.pathResolver.getArrowPath(arrowData, motionData);

    if (!symbolId) {
      console.error("ArrowSvgLoader: No symbol ID available");
      throw new Error("No arrow symbol ID available");
    }

    const themeMode = options?.themeMode ?? this.getCurrentThemeMode();
    const transformedCacheKey = `${symbolId}:${motionData.color}:${themeMode}`;

    // Check transformed cache first
    if (this.transformedSvgCache.has(transformedCacheKey)) {
      this.cacheHits++;
      return this.transformedSvgCache.get(transformedCacheKey)!;
    }

    this.cacheMisses++;

    // Get symbol from sprite
    const symbolData = this.getSymbolData(symbolId);

    if (!symbolData) {
      console.warn(`Arrow symbol not found: ${symbolId}`);
      // Return empty arrow data for missing symbols (placeholders)
      return {
        id: `arrow-${symbolId}`,
        svgContent: "",
        imageSrc: "",
        viewBox: "0 0 100 100",
        center: { x: 50, y: 50 },
        dimensions: {
          width: 100,
          height: 100,
          viewBox: "0 0 100 100",
          center: { x: 50, y: 50 },
        },
      };
    }

    // Create a synthetic SVG text for parsing (mimics individual file format)
    const syntheticSvgText = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${symbolData.viewBox}">${symbolData.innerContent}</svg>`;

    // Parse dimensions
    const parsedSvg = this.svgParser.parseArrowSvg(syntheticSvgText);

    // Apply color transformation
    const coloredSvgText = this.colorTransformer.applyColorToSvg(
      syntheticSvgText,
      motionData.color,
      themeMode
    );

    // Extract inner content
    const svgContent = this.svgParser.extractSvgContent(coloredSvgText);

    const result: ArrowSvgData = {
      id: `arrow-${symbolId}`,
      svgContent: svgContent,
      imageSrc: svgContent,
      viewBox: parsedSvg.viewBox || "100 100",
      center: parsedSvg.center ?? undefined,
      dimensions: {
        width: parsedSvg.width || 100,
        height: parsedSvg.height || 100,
        viewBox: parsedSvg.viewBox || "100 100",
        center: parsedSvg.center ?? undefined,
      },
    };

    // Cache transformed result
    this.transformedSvgCache.set(transformedCacheKey, result);

    return result;
  }

  /**
   * Fetch SVG content (legacy method - redirects to sprite)
   */
  async fetchSvgContent(symbolId: string): Promise<string> {
    await this.loadSprite();
    const symbolData = this.getSymbolData(symbolId);
    if (!symbolData) {
      throw new Error(`Symbol not found: ${symbolId}`);
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${symbolData.viewBox}">${symbolData.innerContent}</svg>`;
  }

  /**
   * Clear caches
   */
  clearCache(): void {
    this.spriteCache.symbols.clear();
    this.spriteCache.loaded = false;
    this.transformedSvgCache.clear();
    this.spriteLoadPromise = null;
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Get cache statistics for performance monitoring
   */
  getCacheStats() {
    return {
      spriteLoaded: this.spriteCache.loaded,
      symbolCount: this.spriteCache.symbols.size,
      transformedCacheSize: this.transformedSvgCache.size,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      hitRate:
        this.cacheHits + this.cacheMisses > 0
          ? (
              (this.cacheHits / (this.cacheHits + this.cacheMisses)) *
              100
            ).toFixed(2) + "%"
          : "0%",
    };
  }

  /**
   * Subscribe to sprite updates (for HMR re-rendering)
   * Returns unsubscribe function
   */
  onSpriteUpdate(callback: () => void): () => void {
    spriteUpdateListeners.add(callback);
    return () => spriteUpdateListeners.delete(callback);
  }
}
