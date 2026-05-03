/**
 * Canvas Management Service
 *
 * Manages canvas creation, pooling, and memory optimization for TKA image export.
 * This service provides efficient canvas resource management to prevent memory
 * leaks and improve performance during image export operations.
 */



interface CanvasPoolEntry {
  canvas: HTMLCanvasElement;
  lastUsed: number;
  inUse: boolean;
}

export class CanvasManager {
  // Canvas pool management
  private canvasPool = new Map<string, CanvasPoolEntry[]>();
  private readonly MAX_POOL_SIZE_PER_DIMENSION = 10;
  private readonly POOL_CLEANUP_INTERVAL = 30000; // 30 seconds
  private readonly MAX_UNUSED_TIME = 60000; // 1 minute

  // Memory tracking
  private totalCanvasMemory = 0;
  private readonly MAX_TOTAL_MEMORY = 512 * 1024 * 1024; // 512MB limit

  // Cleanup timer
  private cleanupTimer: number | undefined;

  constructor() {
    this.startCleanupTimer();
  }

  /**
   * Create optimized canvas
   * Uses pooling for common sizes to improve performance
   */
  createCanvas(width: number, height: number): HTMLCanvasElement {
    if (width <= 0 || height <= 0) {
      throw new Error(`Invalid canvas dimensions: ${width}x${height}`);
    }

    // Check memory limits
    const requiredMemory = width * height * 4; // RGBA bytes
    if (!this.canAllocateMemory(requiredMemory)) {
      this.forceCleanup();
      if (!this.canAllocateMemory(requiredMemory)) {
        throw new Error(
          `Cannot allocate ${Math.round(requiredMemory / 1024 / 1024)}MB for canvas - memory limit exceeded`
        );
      }
    }

    // Try to get canvas from pool
    const poolKey = this.getPoolKey(width, height);
    const pooledCanvas = this.getCanvasFromPool(poolKey);

    if (pooledCanvas) {
      this.prepareCanvas(pooledCanvas, width, height);
      return pooledCanvas;
    }

    // Create new canvas
    const canvas = document.createElement("canvas");
    this.prepareCanvas(canvas, width, height);

    // Track memory usage
    this.totalCanvasMemory += requiredMemory;

    return canvas;
  }

  /**
   * Clone canvas
   * Creates an exact copy of the source canvas
   */
  cloneCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
    if (!source) {
      throw new Error("Source canvas is required for cloning");
    }

    const clone = this.createCanvas(source.width, source.height);
    const ctx = clone.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get 2D context from cloned canvas");
    }

    // Copy source canvas to clone
    ctx.drawImage(source, 0, 0);

    return clone;
  }

  /**
   * Dispose canvas resources
   * Returns canvas to pool or disposes if pool is full
   */
  disposeCanvas(canvas: HTMLCanvasElement): void {
    if (!canvas) {
      return;
    }

    const poolKey = this.getPoolKey(canvas.width, canvas.height);

    // Try to return to pool
    if (this.returnCanvasToPool(canvas, poolKey)) {
      return;
    }

    // Pool is full or canvas too large, dispose completely
    this.forceDisposeCanvas(canvas);
  }

  /**
   * Get canvas memory usage
   * Returns total memory used by tracked canvases
   */
  getMemoryUsage(): number {
    return this.totalCanvasMemory;
  }

  /**
   * Clear canvas cache
   * Removes all pooled canvases and resets memory tracking
   */
  clearCache(): void {
    // Dispose all pooled canvases
    for (const pool of this.canvasPool.values()) {
      for (const entry of pool) {
        this.forceDisposeCanvas(entry.canvas);
      }
    }

    this.canvasPool.clear();
    this.totalCanvasMemory = 0;
  }

  /**
   * Prepare canvas for use
   */
  private prepareCanvas(
    canvas: HTMLCanvasElement,
    width: number,
    height: number
  ): void {
    canvas.width = width;
    canvas.height = height;

    // Clear canvas
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get 2D context from canvas");
    }
    ctx.clearRect(0, 0, width, height);

    // Set default rendering properties for high quality
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
  }

  /**
   * Get pool key for canvas dimensions
   */
  private getPoolKey(width: number, height: number): string {
    return `${width}x${height}`;
  }

  /**
   * Get canvas from pool if available
   */
  private getCanvasFromPool(poolKey: string): HTMLCanvasElement | null {
    const pool = this.canvasPool.get(poolKey);
    if (!pool || pool.length === 0) {
      return null;
    }

    // Find an unused canvas
    const entry = pool.find((e) => !e.inUse);
    if (entry) {
      entry.inUse = true;
      entry.lastUsed = Date.now();
      return entry.canvas;
    }

    return null;
  }

  /**
   * Return canvas to pool
   */
  private returnCanvasToPool(
    canvas: HTMLCanvasElement,
    poolKey: string
  ): boolean {
    let pool = this.canvasPool.get(poolKey);

    if (!pool) {
      pool = [];
      this.canvasPool.set(poolKey, pool);
    }

    // Check if pool is full
    if (pool.length >= this.MAX_POOL_SIZE_PER_DIMENSION) {
      return false;
    }

    // Check if canvas is too large for pooling
    const memorySize = canvas.width * canvas.height * 4;
    if (memorySize > 64 * 1024 * 1024) {
      // 64MB limit for pooling
      return false;
    }

    // Add to pool
    pool.push({
      canvas,
      lastUsed: Date.now(),
      inUse: false,
    });

    return true;
  }

  /**
   * Force dispose canvas (remove from memory tracking)
   */
  private forceDisposeCanvas(canvas: HTMLCanvasElement): void {
    if (canvas) {
      const memorySize = canvas.width * canvas.height * 4;
      this.totalCanvasMemory = Math.max(0, this.totalCanvasMemory - memorySize);

      // Clear canvas
      canvas.width = 0;
      canvas.height = 0;
    }
  }

  /**
   * Check if we can allocate memory
   */
  private canAllocateMemory(requiredBytes: number): boolean {
    return this.totalCanvasMemory + requiredBytes <= this.MAX_TOTAL_MEMORY;
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    if (typeof window !== "undefined") {
      this.cleanupTimer = window.setInterval(() => {
        this.cleanupUnusedCanvases();
      }, this.POOL_CLEANUP_INTERVAL);
    }
  }

  /**
   * Cleanup unused canvases from pool
   */
  private cleanupUnusedCanvases(): void {
    const now = Date.now();

    for (const [poolKey, pool] of this.canvasPool.entries()) {
      // Remove old unused canvases
      const filtered = pool.filter((entry) => {
        const isOld = now - entry.lastUsed > this.MAX_UNUSED_TIME;
        const shouldRemove = !entry.inUse && isOld;

        if (shouldRemove) {
          this.forceDisposeCanvas(entry.canvas);
        }

        return !shouldRemove;
      });

      if (filtered.length === 0) {
        this.canvasPool.delete(poolKey);
      } else {
        this.canvasPool.set(poolKey, filtered);
      }
    }
  }

  /**
   * Force cleanup when memory limit is reached
   */
  private forceCleanup(): void {
    // Remove oldest unused canvases first
    const allEntries: Array<{
      poolKey: string;
      entry: CanvasPoolEntry;
      index: number;
    }> = [];

    for (const [poolKey, pool] of this.canvasPool.entries()) {
      pool.forEach((entry, index) => {
        if (!entry.inUse) {
          allEntries.push({ poolKey, entry, index });
        }
      });
    }

    // Sort by last used time (oldest first)
    allEntries.sort((a, b) => a.entry.lastUsed - b.entry.lastUsed);

    // Remove oldest canvases until we're under memory limit
    for (const { poolKey, entry, index } of allEntries) {
      const pool = this.canvasPool.get(poolKey);
      if (pool) {
        this.forceDisposeCanvas(entry.canvas);
        pool.splice(index, 1);

        if (pool.length === 0) {
          this.canvasPool.delete(poolKey);
        }

        // Check if we've freed enough memory
        if (this.totalCanvasMemory < this.MAX_TOTAL_MEMORY * 0.8) {
          break;
        }
      }
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    totalPools: number;
    totalCanvases: number;
    memoryUsageMB: number;
    maxMemoryMB: number;
    utilizationPercent: number;
  } {
    let totalCanvases = 0;
    for (const pool of this.canvasPool.values()) {
      totalCanvases += pool.length;
    }

    const memoryUsageMB = this.totalCanvasMemory / (1024 * 1024);
    const maxMemoryMB = this.MAX_TOTAL_MEMORY / (1024 * 1024);
    const utilizationPercent =
      (this.totalCanvasMemory / this.MAX_TOTAL_MEMORY) * 100;

    return {
      totalPools: this.canvasPool.size,
      totalCanvases,
      memoryUsageMB,
      maxMemoryMB,
      utilizationPercent,
    };
  }

  /**
   * Optimize canvas for specific use case
   */
  optimizeCanvas(
    canvas: HTMLCanvasElement,
    purpose: "share" | "preview" | "thumbnail"
  ): HTMLCanvasElement {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get 2D context from canvas");
    }

    switch (purpose) {
      case "share":
        // High quality settings for export
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        break;

      case "preview":
        // Balanced quality for preview
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "medium";
        break;

      case "thumbnail":
        // Fast rendering for thumbnails
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "low";
        break;
    }

    return canvas;
  }

  /**
   * Create canvas with specific performance settings
   */
  createOptimizedCanvas(
    width: number,
    height: number,
    purpose: "share" | "preview" | "thumbnail"
  ): HTMLCanvasElement {
    const canvas = this.createCanvas(width, height);
    return this.optimizeCanvas(canvas, purpose);
  }

  /**
   * Batch create canvases
   */
  batchCreateCanvases(
    dimensions: Array<{ width: number; height: number }>,
    purpose: "share" | "preview" | "thumbnail" = "share"
  ): HTMLCanvasElement[] {
    return dimensions.map(({ width, height }) =>
      this.createOptimizedCanvas(width, height, purpose)
    );
  }

  /**
   * Batch dispose canvases
   */
  batchDisposeCanvases(canvases: HTMLCanvasElement[]): void {
    for (const canvas of canvases) {
      this.disposeCanvas(canvas);
    }
  }

  /**
   * Dispose of service and cleanup resources
   */
  dispose(): void {
    if (this.cleanupTimer !== undefined) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    this.clearCache();
  }

  /**
   * Debug method to test canvas management
   */
  debugCanvasManagement(): {
    createTest: boolean;
    poolTest: boolean;
    memoryTest: boolean;
  } {
    let createTest = false;
    let poolTest = false;
    let memoryTest = false;

    try {
      // Test canvas creation
      const testCanvas = this.createCanvas(100, 100);
      createTest = testCanvas.width === 100 && testCanvas.height === 100;

      // Test pooling
      this.disposeCanvas(testCanvas);
      const pooledCanvas = this.createCanvas(100, 100);
      poolTest = pooledCanvas.width === 100 && pooledCanvas.height === 100;

      // Test memory tracking
      const initialMemory = this.getMemoryUsage();
      const bigCanvas = this.createCanvas(1000, 1000);
      const afterMemory = this.getMemoryUsage();
      memoryTest = afterMemory > initialMemory;

      // Cleanup
      this.disposeCanvas(pooledCanvas);
      this.disposeCanvas(bigCanvas);
    } catch (error) {
      console.error("Canvas management debug failed:", error);
    }

    return { createTest, poolTest, memoryTest };
  }
}
