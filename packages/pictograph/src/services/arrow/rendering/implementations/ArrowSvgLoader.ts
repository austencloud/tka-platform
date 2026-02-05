import type { ArrowPlacementData, ArrowSvgData, MotionData } from "@tka/types";
import type { IArrowPathResolver } from "../contracts/IArrowPathResolver";
import type { IArrowSvgParser } from "../contracts/IArrowSvgParser";
import type { IArrowSvgColorTransformer as ISvgColorTransformer } from "../contracts/IArrowSvgColorTransformer";
import type {
  IArrowSvgLoader,
  ArrowSvgLoadOptions,
} from "../contracts/IArrowSvgLoader";
import type { ThemeMode } from "../../../../utils/svg-color-utils";
import type { PictographConfig } from "../../../../config/PictographConfig";

/**
 * SVG Loading Service with aggressive caching.
 *
 * Key optimizations:
 * - Multi-level caching (raw SVG + transformed SVG by color AND theme mode)
 * - Request deduplication (prevents duplicate concurrent fetches)
 * - Performance monitoring (cache hit/miss tracking)
 *
 * Theme mode resolved via PictographConfig injection (replaces scribe's global singleton).
 */
export class ArrowSvgLoader implements IArrowSvgLoader {
  private rawSvgCache = new Map<string, string>();
  private transformedSvgCache = new Map<string, ArrowSvgData>();
  private loadingPromises = new Map<string, Promise<string>>();

  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(
    private pathResolver: IArrowPathResolver,
    private svgParser: IArrowSvgParser,
    private colorTransformer: ISvgColorTransformer,
    private config?: PictographConfig
  ) {}

  private getCurrentThemeMode(): ThemeMode {
    if (this.config) {
      return this.config.getDarkMode() ? "dark" : "light";
    }
    return "dark";
  }

  async loadArrowSvg(
    arrowData: ArrowPlacementData,
    motionData: MotionData,
    options?: ArrowSvgLoadOptions
  ): Promise<ArrowSvgData> {
    const path = this.pathResolver.getArrowPath(arrowData, motionData);

    if (!path) {
      throw new Error("No arrow path available - missing motion data");
    }

    const themeMode = options?.themeMode ?? this.getCurrentThemeMode();
    const transformedCacheKey = `${path}:${motionData.color}:${themeMode}`;

    if (this.transformedSvgCache.has(transformedCacheKey)) {
      this.cacheHits++;
      return this.transformedSvgCache.get(transformedCacheKey)!;
    }

    this.cacheMisses++;

    const originalSvgText = await this.fetchSvgContentCached(path);
    const parsedSvg = this.svgParser.parseArrowSvg(originalSvgText);

    const coloredSvgText = this.colorTransformer.applyColorToSvg(
      originalSvgText,
      motionData.color,
      themeMode
    );

    const svgContent = this.svgParser.extractSvgContent(coloredSvgText);

    const result: ArrowSvgData = {
      id: `arrow-${Date.now()}`,
      svgContent,
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

    this.transformedSvgCache.set(transformedCacheKey, result);
    return result;
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

  clearCache(): void {
    this.rawSvgCache.clear();
    this.transformedSvgCache.clear();
    this.loadingPromises.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  getCacheStats() {
    return {
      rawCacheSize: this.rawSvgCache.size,
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
}
