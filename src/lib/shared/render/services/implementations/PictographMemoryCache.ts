const hmrImageCache: Map<string, HTMLImageElement> =
  (import.meta.hot?.data?.pictographImageCache as Map<string, HTMLImageElement>) ??
  new Map();

const hmrAccessOrder: string[] =
  (import.meta.hot?.data?.pictographAccessOrder as string[]) ?? [];

if (import.meta.hot) {
  import.meta.hot.dispose((data) => {
    data.pictographImageCache = hmrImageCache;
    data.pictographAccessOrder = hmrAccessOrder;
  });
}

const DEFAULT_MAX_ENTRIES = 2000;

export class PictographMemoryCache {
  private cache = hmrImageCache;
  private accessOrder = hmrAccessOrder;
  private maxEntries: number;

  constructor(maxEntries: number = DEFAULT_MAX_ENTRIES) {
    this.maxEntries = maxEntries;
  }

  getKey(baseHash: string, size: number): string {
    return `${baseHash}:${size}`;
  }

  get(key: string): HTMLImageElement | undefined {
    const img = this.cache.get(key);
    if (img) {
      const index = this.accessOrder.indexOf(key);
      if (index !== -1) {
        this.accessOrder.splice(index, 1);
      }
      this.accessOrder.push(key);
    }
    return img;
  }

  set(key: string, img: HTMLImageElement): void {
    if (this.cache.has(key)) {
      this.cache.set(key, img);
      const index = this.accessOrder.indexOf(key);
      if (index !== -1) {
        this.accessOrder.splice(index, 1);
      }
      this.accessOrder.push(key);
      return;
    }

    while (this.cache.size >= this.maxEntries && this.accessOrder.length > 0) {
      const oldest = this.accessOrder.shift();
      if (oldest) {
        this.cache.delete(oldest);
      }
    }

    this.cache.set(key, img);
    this.accessOrder.push(key);
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder.length = 0;
  }

  getStats(): { size: number; maxEntries: number } {
    return {
      size: this.cache.size,
      maxEntries: this.maxEntries,
    };
  }

  setMaxEntries(max: number): void {
    this.maxEntries = Math.max(1, max);

    while (this.cache.size > this.maxEntries && this.accessOrder.length > 0) {
      const oldest = this.accessOrder.shift();
      if (oldest) {
        this.cache.delete(oldest);
      }
    }
  }
}

let hmrPictographMemoryCacheInstance: PictographMemoryCache | null =
  import.meta.hot?.data?.pictographMemoryCacheInstance ?? null;

if (import.meta.hot) {
  import.meta.hot.dispose((data) => {
    data.pictographMemoryCacheInstance = hmrPictographMemoryCacheInstance;
  });
}

function getPictographMemoryCache(): PictographMemoryCache {
  if (!hmrPictographMemoryCacheInstance) {
    hmrPictographMemoryCacheInstance = new PictographMemoryCache();
  }
  return hmrPictographMemoryCacheInstance;
}

export const pictographMemoryCache = getPictographMemoryCache();
