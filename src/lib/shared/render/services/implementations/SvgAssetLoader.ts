/**
 * SVG Asset Loader
 *
 * Pre-loads static SVG assets (grids, common elements) as HTMLImageElement
 * objects for fast Canvas 2D drawing. This is distinct from SvgImageCache
 * which handles dynamic SVG strings from PictographPreparer.
 *
 * Static assets are loaded once on initialization and reused across all renders.
 */

import { getSvgImageCache } from "./SvgImageCache";
import { Letter } from "../../../foundation/domain/models/Letter";
import { getLetterImagePath } from "../../../pictograph/tka-glyph/utils/letter-image-getter";

export interface LetterAsset {
  image: HTMLImageElement;
  dimensions: { width: number; height: number };
}

export interface LoadedAssets {
  grids: {
    diamond: HTMLImageElement | null;
    box: HTMLImageElement | null;
    diamondNonRadial: HTMLImageElement | null;
    boxNonRadial: HTMLImageElement | null;
  };
  letters: Map<string, LetterAsset>;
  turnNumbers: Map<string, HTMLImageElement>;
}

// HMR-aware singleton storage
const hmrAssetLoader: { instance: SvgAssetLoader | null } =
  import.meta.hot?.data?.assetLoader ?? { instance: null };

if (import.meta.hot) {
  import.meta.hot.dispose((data) => {
    data.assetLoader = hmrAssetLoader;
  });
}

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
    console.log("[SvgAssetLoader] Initialized with grid assets");

    // Pre-warm letter cache in background (non-blocking)
    this.preWarmLetterCache();
  }

  /**
   * Pre-load all letter SVGs to avoid on-demand fetching during renders.
   * Runs in background - doesn't block initialization.
   */
  private async preWarmLetterCache(): Promise<void> {
    const start = performance.now();

    // Get unique letter paths (Type3/Type5 use Type2/Type4 base letters)
    const allLetters = Object.values(Letter);
    const uniquePaths = new Set(allLetters.map((letter) => getLetterImagePath(letter)));

    // Load all letters in parallel (limit concurrency to avoid overwhelming browser)
    const BATCH_SIZE = 10;
    const paths = Array.from(uniquePaths);
    let loaded = 0;

    for (let i = 0; i < paths.length; i += BATCH_SIZE) {
      const batch = paths.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (path) => {
          try {
            await this.getLetterAsset(path);
            loaded++;
          } catch {
            // Ignore failures - letter will be loaded on-demand if needed
          }
        })
      );
    }

    const elapsed = performance.now() - start;
    console.log(`[SvgAssetLoader] Pre-warmed ${loaded}/${paths.length} letters in ${elapsed.toFixed(0)}ms`);
  }

  /**
   * Get the appropriate grid image for the given mode
   */
  getGridImage(gridMode: "diamond" | "box"): HTMLImageElement | null {
    return gridMode === "box" ? this.assets.grids.box : this.assets.grids.diamond;
  }

  /**
   * Get the non-radial points overlay for the given mode
   */
  getNonRadialPointsImage(gridMode: "diamond" | "box"): HTMLImageElement | null {
    return gridMode === "box"
      ? this.assets.grids.boxNonRadial
      : this.assets.grids.diamondNonRadial;
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
      // Fetch SVG to get dimensions (done once and cached)
      const response = await fetch(letterPath);
      if (!response.ok) return null;
      const svgText = await response.text();

      // Parse viewBox to get dimensions
      const viewBoxMatch = svgText.match(
        /viewBox\s*=\s*"[\d.-]+\s+[\d.-]+\s+([\d.-]+)\s+([\d.-]+)"/i
      );
      const dimensions = viewBoxMatch
        ? { width: parseFloat(viewBoxMatch[1] || "100"), height: parseFloat(viewBoxMatch[2] || "100") }
        : { width: 100, height: 100 };

      // Load image from cache
      const cache = getSvgImageCache();
      const image = await cache.getImageFromUrl(letterPath);

      const asset: LetterAsset = { image, dimensions };
      this.assets.letters.set(letterPath, asset);
      return asset;
    } catch {
      return null;
    }
  }

  /**
   * @deprecated Use getLetterAsset() instead - returns both image and dimensions
   */
  async getLetterImage(letterPath: string): Promise<HTMLImageElement | null> {
    const asset = await this.getLetterAsset(letterPath);
    return asset?.image ?? null;
  }

  /**
   * Load a turn number SVG as an image (lazy-loaded and cached)
   */
  async getTurnNumberImage(turnValue: number | string): Promise<HTMLImageElement | null> {
    const key = String(turnValue);
    const cached = this.assets.turnNumbers.get(key);
    if (cached) return cached;

    try {
      const cache = getSvgImageCache();
      const path = `/images/numbers/${key}.svg`;
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
  if (!hmrAssetLoader.instance) {
    hmrAssetLoader.instance = new SvgAssetLoader();
  }
  return hmrAssetLoader.instance;
}
