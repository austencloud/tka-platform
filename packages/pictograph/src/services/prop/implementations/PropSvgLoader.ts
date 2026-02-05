import { MotionColor } from "@tka/types";
import type { MotionData, PropPlacementData } from "@tka/types";
import type { PropRenderData } from "../../../domain/PropRenderData";
import type {
  IPropSvgLoader,
  PropSvgLoadOptions,
} from "../contracts/IPropSvgLoader";
import {
  applyMotionColorToSvg,
  type ThemeMode,
} from "../../../utils/svg-color-utils";
import type { PictographConfig } from "../../../config/PictographConfig";

/**
 * Prop SVG Loader with aggressive caching.
 *
 * Key optimizations:
 * - Multi-level caching (raw SVG + transformed SVG by color)
 * - Request deduplication (prevents duplicate concurrent fetches)
 * - Cached metadata parsing (viewBox, center)
 *
 * Theme mode resolved via PictographConfig injection (replaces scribe's global singleton).
 */
export class PropSvgLoader implements IPropSvgLoader {
  private rawSvgCache = new Map<string, string>();
  private transformedSvgCache = new Map<string, PropRenderData>();
  private loadingPromises = new Map<string, Promise<string>>();
  private metadataCache = new Map<
    string,
    {
      viewBox: { width: number; height: number };
      center: { x: number; y: number };
    }
  >();

  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(private config?: PictographConfig) {}

  private getCurrentThemeMode(): ThemeMode {
    if (this.config) {
      return this.config.getDarkMode() ? "dark" : "light";
    }
    return "dark";
  }

  async loadPropSvg(
    propData: PropPlacementData,
    motionData: MotionData,
    useAnimatedVersion: boolean = false,
    options?: PropSvgLoadOptions
  ): Promise<PropRenderData> {
    try {
      const propType = motionData.propType || "staff";
      const color = motionData.color || MotionColor.BLUE;
      const themeMode = options?.themeMode ?? this.getCurrentThemeMode();

      const assetBasePath = this.config?.assetBasePath ?? "";
      const path = useAnimatedVersion
        ? `${assetBasePath}/images/props/animated/${propType}.svg`
        : `${assetBasePath}/images/props/${propType}.svg`;
      const transformedCacheKey = `${path}:${color}:${themeMode}`;

      if (this.transformedSvgCache.has(transformedCacheKey)) {
        this.cacheHits++;
        const cached = this.transformedSvgCache.get(transformedCacheKey)!;
        return {
          ...cached,
          position: { x: propData.positionX, y: propData.positionY },
          rotation: propData.rotationAngle,
        };
      }

      this.cacheMisses++;

      const originalSvgText = await this.fetchSvgContentCached(path);
      const { viewBox, center } = this.parsePropSvgCached(
        originalSvgText,
        path
      );

      const coloredSvgText = applyMotionColorToSvg(originalSvgText, color, {
        makeClassNamesUnique: true,
        themeMode,
      });

      const svgContent = this.extractSvgContent(coloredSvgText);

      const result: PropRenderData = {
        position: { x: propData.positionX, y: propData.positionY },
        rotation: propData.rotationAngle,
        svgData: {
          svgContent,
          viewBox,
          center,
        },
        loaded: true,
        error: null,
      };

      this.transformedSvgCache.set(transformedCacheKey, result);
      return result;
    } catch (error) {
      console.error("PropSvgLoader: Error loading prop SVG:", error);
      return {
        position: { x: 475, y: 475 },
        rotation: 0,
        svgData: null,
        loaded: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async fetchSvgContentCached(path: string): Promise<string> {
    if (this.rawSvgCache.has(path)) {
      return this.rawSvgCache.get(path)!;
    }

    if (this.loadingPromises.has(path)) {
      return this.loadingPromises.get(path)!;
    }

    const loadingPromise = this.fetchSvgContent(path);
    this.loadingPromises.set(path, loadingPromise);

    try {
      const svgText = await loadingPromise;
      this.rawSvgCache.set(path, svgText);
      this.loadingPromises.delete(path);
      return svgText;
    } catch (error) {
      this.loadingPromises.delete(path);
      throw error;
    }
  }

  async fetchSvgContent(path: string): Promise<string> {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to fetch SVG: ${response.status}`);
    }
    return await response.text();
  }

  private parsePropSvgCached(
    svgText: string,
    cacheKey: string
  ): {
    viewBox: { width: number; height: number };
    center: { x: number; y: number };
  } {
    if (this.metadataCache.has(cacheKey)) {
      return this.metadataCache.get(cacheKey)!;
    }

    const result = this.parsePropSvg(svgText);
    this.metadataCache.set(cacheKey, result);
    return result;
  }

  private parsePropSvg(svgText: string): {
    viewBox: { width: number; height: number };
    center: { x: number; y: number };
  } {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml");
    const svgElement = doc.querySelector("svg");

    if (!svgElement) {
      throw new Error("Invalid SVG: No SVG element found");
    }

    const viewBoxAttr = svgElement.getAttribute("viewBox");
    let width = 100,
      height = 100;

    if (viewBoxAttr) {
      const [, , w, h] = viewBoxAttr.split(" ").map(Number);
      width = w || 100;
      height = h || 100;
    }

    return {
      viewBox: { width, height },
      center: { x: width / 2, y: height / 2 },
    };
  }

  private extractSvgContent(svgText: string): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml");
    const svgElement = doc.querySelector("svg");

    if (!svgElement) {
      return svgText;
    }

    return svgElement.innerHTML;
  }

  clearCache(): void {
    this.rawSvgCache.clear();
    this.transformedSvgCache.clear();
    this.loadingPromises.clear();
    this.metadataCache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  getCacheStats() {
    return {
      rawCacheSize: this.rawSvgCache.size,
      transformedCacheSize: this.transformedSvgCache.size,
      metadataCacheSize: this.metadataCache.size,
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
}
