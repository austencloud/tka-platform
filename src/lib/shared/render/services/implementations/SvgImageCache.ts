/**
 * SVG Image Cache
 *
 * Converts SVG strings to HTMLImageElement objects and caches them.
 * This is the key optimization - converting SVG once and reusing the image.
 *
 * SVG → Image conversion is ~5ms
 * Drawing cached image is ~0.1ms
 */

export class SvgImageCache {
  private cache = new Map<string, HTMLImageElement>();
  private pendingLoads = new Map<string, Promise<HTMLImageElement>>();

  /**
   * Get or create an image from an SVG string
   * @param svgString The SVG content as a string
   * @param cacheKey Optional cache key (defaults to hash of SVG string)
   */
  async getImage(svgString: string, cacheKey?: string): Promise<HTMLImageElement> {
    const key = cacheKey || this.hashString(svgString);

    // Check cache first
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }

    // Check if already loading
    const pending = this.pendingLoads.get(key);
    if (pending) {
      return pending;
    }

    // Start loading
    const loadPromise = this.svgToImage(svgString);
    this.pendingLoads.set(key, loadPromise);

    try {
      const img = await loadPromise;
      this.cache.set(key, img);
      return img;
    } finally {
      this.pendingLoads.delete(key);
    }
  }

  /**
   * Get or create an image from an SVG URL
   */
  async getImageFromUrl(url: string): Promise<HTMLImageElement> {
    // Check cache first
    const cached = this.cache.get(url);
    if (cached) {
      return cached;
    }

    // Check if already loading
    const pending = this.pendingLoads.get(url);
    if (pending) {
      return pending;
    }

    // Start loading
    const loadPromise = this.loadImageFromUrl(url);
    this.pendingLoads.set(url, loadPromise);

    try {
      const img = await loadPromise;
      this.cache.set(url, img);
      return img;
    } finally {
      this.pendingLoads.delete(url);
    }
  }

  /**
   * Convert SVG string to HTMLImageElement
   */
  private svgToImage(svgString: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        URL.revokeObjectURL(img.src);
        resolve(img);
      };

      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        reject(new Error("Failed to load SVG as image"));
      };

      // Create blob URL from SVG string
      const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      img.src = URL.createObjectURL(blob);
    });
  }

  /**
   * Load image from URL
   */
  private loadImageFromUrl(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));

      img.src = url;
    });
  }

  /**
   * Simple string hash for cache keys
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `svg_${hash}`;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      pendingLoads: this.pendingLoads.size,
    };
  }

  /**
   * Clear the cache
   */
  clear() {
    this.cache.clear();
    this.pendingLoads.clear();
  }
}

// Singleton instance for global access
let instance: SvgImageCache | null = null;

export function getSvgImageCache(): SvgImageCache {
  if (!instance) {
    instance = new SvgImageCache();
  }
  return instance;
}
