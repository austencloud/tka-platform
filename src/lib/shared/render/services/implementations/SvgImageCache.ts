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
   * Detects environment and uses appropriate method (browser vs Node.js)
   */
  private svgToImage(svgString: string): Promise<HTMLImageElement> {
    // Detect environment - check for browser globals
    if (typeof window !== 'undefined' && typeof Blob !== 'undefined' && typeof URL !== 'undefined') {
      return this.browserSvgToImage(svgString);
    } else {
      return this.nodeSvgToImage(svgString);
    }
  }

  /**
   * Browser implementation using Blob + createObjectURL
   */
  private browserSvgToImage(svgString: string): Promise<HTMLImageElement> {
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
   * Node.js implementation using canvas package's Image with data URL
   */
  private async nodeSvgToImage(svgString: string): Promise<any> {
    return new Promise(async (resolve, reject) => {
      try {
        // Dynamic import for ES modules
        const canvas = await import('canvas');
        const { Image } = canvas;
        const img = new Image();

        img.onload = () => resolve(img);
        img.onerror = (err: Error) => reject(new Error(`Failed to load SVG as image: ${err.message}`));

        // Node-canvas requires explicit width and height on SVG element
        // Extract from viewBox and add if missing
        let processedSvg = svgString;
        if (!svgString.includes('width=') || !svgString.includes('height=')) {
          const viewBoxMatch = svgString.match(/viewBox\s*=\s*["']([^"']+)["']/);
          if (viewBoxMatch?.[1]) {
            // viewBox format: "x y width height" (e.g., "0 0 950 950")
            const parts = viewBoxMatch[1].split(/\s+/).map(Number);
            const width = parts[2];
            const height = parts[3];
            if (width && height) {
              // Add width and height attributes to the <svg> tag
              processedSvg = svgString.replace(
                /<svg([^>]*)>/,
                `<svg$1 width="${width}" height="${height}">`
              );
            }
          }
        }

        // Convert SVG to base64 data URL
        // Node-canvas supports data URLs for SVG images
        const base64 = Buffer.from(processedSvg).toString('base64');
        img.src = `data:image/svg+xml;base64,${base64}`;
      } catch (error) {
        reject(new Error(`Node.js canvas package not available: ${error}`));
      }
    });
  }

  /**
   * Load image from URL
   * Detects environment and uses appropriate method (browser vs Node.js)
   */
  private async loadImageFromUrl(url: string): Promise<HTMLImageElement> {
    // Detect environment
    if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
      // Browser: use standard Image loading
      return this.browserLoadImageFromUrl(url);
    } else {
      // Node.js: read from file system and convert SVG
      return this.nodeLoadImageFromUrl(url);
    }
  }

  /**
   * Browser implementation for loading images from URLs
   */
  private browserLoadImageFromUrl(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));

      img.src = url;
    });
  }

  /**
   * Node.js implementation for loading images from file system
   */
  private async nodeLoadImageFromUrl(url: string): Promise<any> {
    try {
      // Dynamic imports for ES modules
      const fs = await import('fs');
      const path = await import('path');

      // Convert URL path to file system path
      // /images/grid/diamond_grid.svg → static/images/grid/diamond_grid.svg

      // Remove leading slash and prepend 'static'
      const relativePath = url.startsWith('/') ? url.slice(1) : url;
      const filePath = path.join(process.cwd(), 'static', relativePath);

      // Read the SVG file
      const svgContent = fs.readFileSync(filePath, 'utf-8');

      // Convert SVG string to Image using our existing method
      const img = await this.nodeSvgToImage(svgContent);
      return img;
    } catch (error) {
      console.error(`[SvgImageCache] Failed to load ${url}:`, error);
      throw new Error(`Failed to load image from ${url}: ${error}`);
    }
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

/**
 * Clear the global SVG image cache.
 * Call this when SVG content may have changed (e.g., after code updates).
 */
export function clearSvgImageCache(): void {
  if (instance) {
    instance.clear();
  }
}
