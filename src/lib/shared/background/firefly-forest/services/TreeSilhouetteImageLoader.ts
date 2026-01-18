/**
 * Tree Silhouette Image Loader
 *
 * Loads and caches AI-generated tree silhouette images for the Firefly Forest.
 * Pre-renders images to offscreen canvases for optimal drawing performance.
 */

export type TreeCategory = 'pine' | 'fir' | 'spruce' | 'oak' | 'maple' | 'poplar' | 'willow' | 'dead';

interface TreeImage {
  category: TreeCategory;
  filename: string;
  canvas: OffscreenCanvas | HTMLCanvasElement;
  width: number;
  height: number;
  aspectRatio: number;
}

// Tree image counts per category (from our curated collection)
const TREE_COUNTS: Record<TreeCategory, number> = {
  pine: 12,
  fir: 5,
  spruce: 4,
  oak: 12,
  maple: 12,
  poplar: 6,
  willow: 13,
  dead: 18,
};

const BASE_PATH = '/images/trees/curated';

/**
 * Creates a tree silhouette image loader
 */
export function createTreeSilhouetteImageLoader() {
  const imageCache = new Map<string, TreeImage>();
  const categoryImages = new Map<TreeCategory, TreeImage[]>();
  let ready = false;
  let loadPromise: Promise<void> | null = null;

  /**
   * Generate the path for a tree image
   */
  function getImagePath(category: TreeCategory, index: number): string {
    const paddedIndex = String(index).padStart(2, '0');
    return `${BASE_PATH}/${category}_${paddedIndex}.png`;
  }

  /**
   * Load a single image and create a pre-rendered canvas
   */
  async function loadImage(category: TreeCategory, index: number): Promise<TreeImage | null> {
    const path = getImagePath(category, index);
    const cacheKey = `${category}_${index}`;

    // Check cache first
    if (imageCache.has(cacheKey)) {
      return imageCache.get(cacheKey)!;
    }

    return new Promise((resolve) => {
      const img = new Image();

      img.onload = () => {
        // Create offscreen canvas for fast drawing
        let canvas: OffscreenCanvas | HTMLCanvasElement;
        let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;

        if (typeof OffscreenCanvas !== 'undefined') {
          canvas = new OffscreenCanvas(img.naturalWidth, img.naturalHeight);
          ctx = canvas.getContext('2d');
        } else {
          canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          ctx = canvas.getContext('2d');
        }

        if (ctx) {
          ctx.drawImage(img, 0, 0);
        }

        const treeImage: TreeImage = {
          category,
          filename: `${category}_${String(index).padStart(2, '0')}.png`,
          canvas,
          width: img.naturalWidth,
          height: img.naturalHeight,
          aspectRatio: img.naturalWidth / img.naturalHeight,
        };

        imageCache.set(cacheKey, treeImage);
        resolve(treeImage);
      };

      img.onerror = () => {
        // Silently skip missing images
        resolve(null);
      };

      img.src = path;
    });
  }

  /**
   * Preload all tree images
   */
  async function preload(): Promise<void> {
    if (ready) return;
    if (loadPromise) return loadPromise;

    loadPromise = (async () => {
      if (typeof window === 'undefined') return;

      const loadPromises: Promise<TreeImage | null>[] = [];

      // Load all images for each category
      for (const [category, count] of Object.entries(TREE_COUNTS)) {
        for (let i = 1; i <= count; i++) {
          loadPromises.push(loadImage(category as TreeCategory, i));
        }
      }

      const results = await Promise.all(loadPromises);

      // Organize by category
      for (const category of Object.keys(TREE_COUNTS) as TreeCategory[]) {
        categoryImages.set(category, []);
      }

      for (const result of results) {
        if (result) {
          const list = categoryImages.get(result.category);
          if (list) {
            list.push(result);
          }
        }
      }

      ready = true;
    })();

    return loadPromise;
  }

  /**
   * Get a random tree image from a category
   */
  function getRandomFromCategory(category: TreeCategory, seed?: number): TreeImage | null {
    const images = categoryImages.get(category);
    if (!images || images.length === 0) return null;

    const index = seed !== undefined
      ? Math.floor(Math.abs(seed * 10000) % images.length)
      : Math.floor(Math.random() * images.length);

    return images[index] || null;
  }

  /**
   * Get a unique tree image from a category (not already used)
   * Falls back to allowing duplicates if all images exhausted
   */
  function getUniqueFromCategory(
    category: TreeCategory,
    usedImages: Set<string>,
    seed?: number
  ): TreeImage | null {
    const images = categoryImages.get(category);
    if (!images || images.length === 0) return null;

    // Filter to unused images
    const availableImages = images.filter(img => !usedImages.has(img.filename));

    // If all used, allow duplicates (fall back to full list)
    const pool = availableImages.length > 0 ? availableImages : images;

    const index = seed !== undefined
      ? Math.floor(Math.abs(seed * 10000) % pool.length)
      : Math.floor(Math.random() * pool.length);

    return pool[index] || null;
  }

  /**
   * Get all images from a category
   */
  function getCategory(category: TreeCategory): TreeImage[] {
    return categoryImages.get(category) || [];
  }

  /**
   * Get a specific tree image
   */
  function getImage(category: TreeCategory, index: number): TreeImage | null {
    const cacheKey = `${category}_${index}`;
    return imageCache.get(cacheKey) || null;
  }

  /**
   * Check if images are loaded and ready
   */
  function isReady(): boolean {
    return ready;
  }

  /**
   * Get total loaded image count
   */
  function getLoadedCount(): number {
    return imageCache.size;
  }

  /**
   * Get count per category
   */
  function getCategoryCounts(): Record<TreeCategory, number> {
    const counts: Partial<Record<TreeCategory, number>> = {};
    for (const [category, images] of categoryImages.entries()) {
      counts[category] = images.length;
    }
    return counts as Record<TreeCategory, number>;
  }

  return {
    preload,
    getRandomFromCategory,
    getUniqueFromCategory,
    getCategory,
    getImage,
    isReady,
    getLoadedCount,
    getCategoryCounts,
  };
}

export type TreeSilhouetteImageLoader = ReturnType<typeof createTreeSilhouetteImageLoader>;
