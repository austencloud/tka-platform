/**
 * Canvas2D Application Manager
 *
 * Handles canvas lifecycle:
 * - Initialization and configuration
 * - Canvas management
 * - Resize operations
 * - Cleanup and disposal
 *
 * Single Responsibility: Canvas setup and lifecycle
 */

// Dark Mode background color (near-black)
const DARK_MODE_BACKGROUND = "#0a0a0f";

export class Canvas2DApplicationManager {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private currentSize: number = 500;
  private backgroundAlpha: number = 1;
  private isInitialized: boolean = false;
  private darkModeEnabled: boolean = false;

  async initialize(
    container: HTMLElement,
    size: number,
    backgroundAlpha: number = 1
  ): Promise<void> {
    if (this.isInitialized) {
      console.warn("[Canvas2DApplicationManager] Already initialized");
      return;
    }

    this.currentSize = size;
    this.backgroundAlpha = backgroundAlpha;

    // Create canvas element
    this.canvas = document.createElement("canvas");
    this.canvas.width = size;
    this.canvas.height = size;
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";

    // Get 2D context with alpha support based on backgroundAlpha
    this.ctx = this.canvas.getContext("2d", {
      alpha: backgroundAlpha < 1,
      // Optimize for frequent redraws
      desynchronized: true,
    });

    if (!this.ctx) {
      throw new Error("Failed to get 2D rendering context");
    }

    // Enable high-quality image rendering
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = "high";

    // Append canvas to container
    container.appendChild(this.canvas);

    this.isInitialized = true;
  }

  resize(newSize: number): void {
    if (!this.isInitialized || !this.canvas || !this.ctx) return;

    this.currentSize = newSize;
    this.canvas.width = newSize;
    this.canvas.height = newSize;

    // Re-apply context settings after resize (they reset)
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = "high";
  }

  /**
   * Clear the canvas and optionally fill with background
   */
  clear(): void {
    if (!this.ctx || !this.canvas) return;

    // Clear entire canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Dark Mode: dark background
    if (this.darkModeEnabled) {
      this.ctx.globalAlpha = 1;
      this.ctx.fillStyle = DARK_MODE_BACKGROUND;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    } else {
      this._darkModeLoggedOnce = false;
      if (this.backgroundAlpha > 0) {
        // Normal mode: white background
        this.ctx.globalAlpha = this.backgroundAlpha;
        this.ctx.fillStyle = "#ffffff";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.globalAlpha = 1;
      }
    }
  }
  private _darkModeLoggedOnce = false;

  /**
   * Set Dark Mode (dark background)
   */
  setDarkMode(enabled: boolean): void {
    this.darkModeEnabled = enabled;
  }

  /**
   * Check if Dark Mode is enabled
   */
  isDarkModeEnabled(): boolean {
    return this.darkModeEnabled;
  }

  getContext(): CanvasRenderingContext2D | null {
    return this.ctx;
  }

  getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }

  getCurrentSize(): number {
    return this.currentSize;
  }

  isReady(): boolean {
    return this.isInitialized && this.canvas !== null && this.ctx !== null;
  }

  /**
   * Capture current canvas as ImageBitmap
   */
  async captureFrame(): Promise<ImageBitmap> {
    if (!this.canvas) {
      throw new Error("Canvas not initialized");
    }
    return createImageBitmap(this.canvas);
  }

  destroy(): void {
    if (!this.canvas) return;

    // Remove from DOM
    if (this.canvas.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }

    // CRITICAL: Set dimensions to 0 to release pixel buffer memory
    this.canvas.width = 0;
    this.canvas.height = 0;

    this.canvas = null;
    this.ctx = null;
    this.isInitialized = false;
  }
}
