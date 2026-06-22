/**
 * SVG Asset Loader
 *
 * Pre-loads static SVG assets (grids, common elements) as DrawableImage
 * objects (ImageBitmap or HTMLImageElement) for fast Canvas 2D drawing.
 * This is distinct from SvgImageCache which handles dynamic SVG strings
 * from PictographPreparer.
 *
 * Static assets are loaded once on initialization and reused across all renders.
 * Works in both main thread and Web Workers.
 */

import { getSvgImageCache, type DrawableImage } from "./svg-image-cache";
import { Letter } from "../../foundation/domain/models/letter";
import { getLetterImagePath } from "../../pictograph/tka-glyph/utils/letter-image-getter";
import { assetFetch } from "../../net/asset-fetch";

export interface LetterAsset {
  image: DrawableImage;
  dimensions: { width: number; height: number };
}

export interface LoadedAssets {
  grids: {
    diamond: DrawableImage | null;
    box: DrawableImage | null;
    diamondNonRadial: DrawableImage | null;
    boxNonRadial: DrawableImage | null;
  };
  letters: Map<string, LetterAsset>;
  turnNumbers: Map<string, DrawableImage>;
}

// Plain singleton — no import.meta.hot here. HMR in a worker pulls in
// SvelteKit's fetcher.js which accesses window.fetch at module scope,
// crashing the composition worker (workers have self, not window).
let singletonInstance: SvgAssetLoader | null = null;

export class SvgAssetLoader {
  private assets: LoadedAssets = {
    grids: {
      diamond: null,
      box: null,
      diamondNonRadial: null,
      boxNonRadial: null,
    },
    letters: new Map(),
    turnNumbers: new Map(),
  };

  private initialized = false;
  private initializing: Promise<void> | null = null;

  /**
   * Initialize the asset loader by pre-loading all static SVG assets
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Prevent multiple concurrent initializations
    if (this.initializing) {
      return this.initializing;
    }

    this.initializing = this.doInitialize();
    await this.initializing;
    this.initializing = null;
  }

  private async doInitialize(): Promise<void> {
    const cache = getSvgImageCache();

    // Load grid SVGs in parallel
    const [diamond, box, diamondNonRadial, boxNonRadial] = await Promise.all([
      cache.getImageFromUrl("/images/grid/diamond_grid.svg").catch(() => null),
      cache.getImageFromUrl("/images/grid/box_grid.svg").catch(() => null),
      cache.getImageFromUrl("/images/grid/diamond_nonradial_points.svg").catch(() => null),
      cache.getImageFromUrl("/images/grid/box_nonradial_points.svg").catch(() => null),
    ]);

    this.assets.grids = {
      diamond,
      box,
      diamondNonRadial,
      boxNonRadial,
    };

    this.initialized = true;

    // Pre-warm letter cache in background (non-blocking)
    this.preWarmLetterCache();
  }

  /**
   * Pre-load all letter SVGs to avoid on-demand fetching during renders.
   * Runs in background - doesn't block initialization.
   */
  private async preWarmLetterCache(): Promise<void> {
    // Get unique letter paths (Type3/Type5 use Type2/Type4 base letters)
    const allLetters = Object.values(Letter);
    const uniquePaths = new Set(allLetters.map((letter) => getLetterImagePath(letter)));

    // Load all letters in parallel (limit concurrency to avoid overwhelming browser)
    const BATCH_SIZE = 10;
    const paths = Array.from(uniquePaths);

    for (let i = 0; i < paths.length; i += BATCH_SIZE) {
      const batch = paths.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (path) => {
          try {
            await this.getLetterAsset(path);
          } catch {
            // Ignore failures - letter will be loaded on-demand if needed
          }
        })
      );
    }
  }

  /**
   * Get the appropriate grid image for the given mode
   */
  getGridImage(gridMode: "diamond" | "box"): DrawableImage | null {
    return gridMode === "box" ? this.assets.grids.box : this.assets.grids.diamond;
  }

  /**
   * Get the non-radial points overlay for the given mode
   */
  getNonRadialPointsImage(gridMode: "diamond" | "box"): DrawableImage | null {
    return gridMode === "box"
      ? this.assets.grids.boxNonRadial
      : this.assets.grids.diamondNonRadial;
  }

  /** Seed the four grid drawables directly (worker path — skips fetch+decode). */
  seedGrids(grids: LoadedAssets["grids"]): void {
    this.assets.grids = grids;
    this.initialized = true;
  }

  /** Snapshot the four grid drawables (main thread — feeds an AssetBundle). */
  snapshotGrids(): LoadedAssets["grids"] {
    return { ...this.assets.grids };
  }

  // Pending letter loads to prevent duplicate fetches
  private pendingLetters = new Map<string, Promise<LetterAsset | null>>();

  /**
   * Load a letter SVG as an image with dimensions (lazy-loaded and cached)
   * This fetches the SVG once, parses dimensions, and caches both.
   */
  async getLetterAsset(letterPath: string): Promise<LetterAsset | null> {
    // Check local cache first
    const cached = this.assets.letters.get(letterPath);
    if (cached) return cached;

    // Check if already loading
    const pending = this.pendingLetters.get(letterPath);
    if (pending) return pending;

    // Start loading
    const loadPromise = this.loadLetterAsset(letterPath);
    this.pendingLetters.set(letterPath, loadPromise);

    try {
      const asset = await loadPromise;
      return asset;
    } finally {
      this.pendingLetters.delete(letterPath);
    }
  }

  private async loadLetterAsset(letterPath: string): Promise<LetterAsset | null> {
    try {
      let svgText: string;
      if (typeof fetch !== 'undefined') {
        const response = await assetFetch(letterPath);
        if (!response.ok) return null;
        svgText = await response.text();
      } else {
        const fs = await import('fs');
        const path = await import('path');

        const relativePath = letterPath.startsWith('/') ? letterPath.slice(1) : letterPath;
        const filePath = path.join(process.cwd(), 'static', relativePath);
        svgText = fs.readFileSync(filePath, 'utf-8');
      }

      const viewBoxMatch = svgText.match(
        /viewBox\s*=\s*"[\d.-]+\s+[\d.-]+\s+([\d.-]+)\s+([\d.-]+)"/i
      );
      const dimensions = viewBoxMatch
        ? { width: parseFloat(viewBoxMatch[1] || "100"), height: parseFloat(viewBoxMatch[2] || "100") }
        : { width: 100, height: 100 };

      // Create image from already-fetched SVG text (single request, no duplicate fetch)
      const cache = getSvgImageCache();
      const image = await cache.getImage(svgText, letterPath);

      const asset: LetterAsset = { image, dimensions };
      this.assets.letters.set(letterPath, asset);
      return asset;
    } catch (error) {
      if (typeof window !== "undefined") {
        console.warn(`[SvgAssetLoader] Failed to load letter ${letterPath}:`, error);
      }
      return null;
    }
  }

  /**
   * @deprecated Use getLetterAsset() instead - returns both image and dimensions
   */
  async getLetterImage(letterPath: string): Promise<DrawableImage | null> {
    const asset = await this.getLetterAsset(letterPath);
    return asset?.image ?? null;
  }

  /**
   * Load a turn number SVG as an image (lazy-loaded and cached)
   */
  async getTurnNumberImage(turnValue: number | string): Promise<DrawableImage | null> {
    const key = String(turnValue);
    const cached = this.assets.turnNumbers.get(key);
    if (cached) return cached;

    try {
      const cache = getSvgImageCache();
      // "fl" is the parsed turn value but the SVG file is named "float.svg"
      const filename = key === "fl" ? "float" : key;
      const path = `/images/numbers/${filename}.svg`;
      const img = await cache.getImageFromUrl(path);
      this.assets.turnNumbers.set(key, img);
      return img;
    } catch {
      return null;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getStats() {
    return {
      initialized: this.initialized,
      gridsLoaded: Object.values(this.assets.grids).filter(Boolean).length,
      lettersLoaded: this.assets.letters.size,
      turnNumbersLoaded: this.assets.turnNumbers.size,
    };
  }
}

/**
 * Get the singleton SvgAssetLoader instance
 */
export function getSvgAssetLoader(): SvgAssetLoader {
  if (!singletonInstance) {
    singletonInstance = new SvgAssetLoader();
  }
  return singletonInstance;
}
