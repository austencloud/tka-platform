/**
 * SVG Preload Service Implementation
 *
 * Preloads and caches SVG assets to eliminate loading delays in pictographs.
 * Uses aggressive caching and parallel loading for optimal performance.
 *
 * Accepts assetBasePath via constructor for cross-app usage.
 */

import type { ISvgPreloader } from "../contracts/ISvgPreloader";

interface PreloadProgress {
  loaded: number;
  total: number;
}

export class SvgPreloader implements ISvgPreloader {
  private svgCache = new Map<string, string>();
  private loadingPromises = new Map<string, Promise<string>>();
  private progress: PreloadProgress = { loaded: 0, total: 0 };

  private readonly ESSENTIAL_PROPS = [
    "staff",
    "simple_staff",
    "club",
    "fan",
    "triad",
    "minihoop",
    "buugeng",
    "triquetra",
    "sword",
    "hand",
    "guitar",
    "ukulele",
  ];

  private readonly GRID_TYPES = ["diamond_grid", "box_grid", "skewed_grid"];

  constructor(private readonly assetBasePath: string = "") {}

  async preloadEssentialSvgs(): Promise<void> {
    this.progress.total = this.ESSENTIAL_PROPS.length + this.GRID_TYPES.length;
    this.progress.loaded = 0;

    const gridPromises = this.preloadGridSvgs();
    const propPromises = this.preloadPropSvgs(this.ESSENTIAL_PROPS);

    await Promise.all([gridPromises, propPromises]);
  }

  async preloadPropSvgs(propTypes: string[]): Promise<void> {
    const promises = propTypes.map((propType) =>
      this.loadSvg("prop", propType)
    );
    await Promise.all(promises);
  }

  async preloadGridSvgs(): Promise<void> {
    const promises = this.GRID_TYPES.map((gridType) =>
      this.loadSvg("grid", gridType)
    );
    await Promise.all(promises);
  }

  async preloadArrowSvgs(): Promise<void> {
    // No-op - arrows use separate loading system
    return Promise.resolve();
  }

  async getSvgContent(
    type: "prop" | "grid" | "arrow",
    name: string
  ): Promise<string> {
    const cacheKey = `${type}:${name}`;

    if (this.svgCache.has(cacheKey)) {
      return this.svgCache.get(cacheKey)!;
    }

    if (this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey)!;
    }

    return this.loadSvg(type, name);
  }

  isCached(type: "prop" | "grid" | "arrow", name: string): boolean {
    const cacheKey = `${type}:${name}`;
    return this.svgCache.has(cacheKey);
  }

  getPreloadProgress(): { loaded: number; total: number; percentage: number } {
    const percentage =
      this.progress.total > 0
        ? (this.progress.loaded / this.progress.total) * 100
        : 0;
    return {
      ...this.progress,
      percentage: Math.round(percentage),
    };
  }

  clearCache(): void {
    this.svgCache.clear();
    this.loadingPromises.clear();
    this.progress = { loaded: 0, total: 0 };
  }

  private async loadSvg(
    type: "prop" | "grid" | "arrow",
    name: string
  ): Promise<string> {
    const cacheKey = `${type}:${name}`;

    if (this.svgCache.has(cacheKey)) {
      return this.svgCache.get(cacheKey)!;
    }

    if (this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey)!;
    }

    const loadingPromise = this.fetchSvg(type, name);
    this.loadingPromises.set(cacheKey, loadingPromise);

    try {
      const svgContent = await loadingPromise;
      this.svgCache.set(cacheKey, svgContent);
      this.progress.loaded++;
      this.loadingPromises.delete(cacheKey);
      return svgContent;
    } catch (error) {
      this.loadingPromises.delete(cacheKey);
      throw error;
    }
  }

  private async fetchSvg(
    type: "prop" | "grid" | "arrow",
    name: string
  ): Promise<string> {
    let url: string;
    const base = this.assetBasePath;

    if (type === "prop") {
      url = `${base}/images/props/${name}.svg`;
    } else if (type === "grid") {
      url = `${base}/images/grid/${name}.svg`;
    } else {
      url = `${base}/images/arrows/${name}.svg`;
    }

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Failed to load ${type} SVG: ${name} (${response.status})`
      );
    }

    return response.text();
  }
}
