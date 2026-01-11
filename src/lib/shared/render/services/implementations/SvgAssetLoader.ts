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

export interface LoadedAssets {
  grids: {
    diamond: HTMLImageElement | null;
    box: HTMLImageElement | null;
    diamondNonRadial: HTMLImageElement | null;
    boxNonRadial: HTMLImageElement | null;
  };
  letters: Map<string, HTMLImageElement>;
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

  /**
   * Load a letter SVG as an image (lazy-loaded and cached)
   */
  async getLetterImage(letterPath: string): Promise<HTMLImageElement | null> {
    // Check local cache first
    const cached = this.assets.letters.get(letterPath);
    if (cached) return cached;

    // Load from SvgImageCache
    try {
      const cache = getSvgImageCache();
      const img = await cache.getImageFromUrl(letterPath);
      this.assets.letters.set(letterPath, img);
      return img;
    } catch {
      return null;
    }
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
