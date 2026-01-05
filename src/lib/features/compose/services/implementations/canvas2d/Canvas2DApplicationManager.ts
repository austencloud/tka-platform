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
const LIGHT_MODE_BACKGROUND = "#ffffff";
// Transition duration synced with pictograph transitions (150ms)
const BACKGROUND_TRANSITION_DURATION = 150;

/**
 * Parse hex color to RGB components
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result || !result[1] || !result[2] || !result[3]) {
    return { r: 255, g: 255, b: 255 };
  }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

/**
 * Convert RGB to hex color
 */
function rgbToHex(r: number, g: number, b: number): string {
  return `#${Math.round(r).toString(16).padStart(2, "0")}${Math.round(g).toString(16).padStart(2, "0")}${Math.round(b).toString(16).padStart(2, "0")}`;
}

/**
 * Interpolate between two colors
 */
function interpolateColor(from: string, to: string, progress: number): string {
  const fromRgb = hexToRgb(from);
  const toRgb = hexToRgb(to);
  return rgbToHex(
    fromRgb.r + (toRgb.r - fromRgb.r) * progress,
    fromRgb.g + (toRgb.g - fromRgb.g) * progress,
    fromRgb.b + (toRgb.b - fromRgb.b) * progress
  );
}

export class Canvas2DApplicationManager {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private currentSize: number = 500;
  private backgroundAlpha: number = 1;
  private isInitialized: boolean = false;
  private darkModeEnabled: boolean = false;

  // Background transition state
  private bgTransitionStartTime: number = 0;
  private bgTransitionFromColor: string = LIGHT_MODE_BACKGROUND;
  private bgTransitionToColor: string = LIGHT_MODE_BACKGROUND;
  private currentBgColor: string = LIGHT_MODE_BACKGROUND;

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
   * Uses interpolated background color during dark mode transitions
   */
  clear(): void {
    if (!this.ctx || !this.canvas) return;

    // Clear entire canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Update background color transition if in progress
    this.updateBackgroundTransition();

    // Fill with current (possibly transitioning) background color
    if (this.backgroundAlpha > 0) {
      this.ctx.globalAlpha = this.backgroundAlpha;
      this.ctx.fillStyle = this.currentBgColor;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.globalAlpha = 1;
    }
  }

  /**
   * Update background color transition progress
   * Uses ease-out timing to match CSS transitions
   */
  private updateBackgroundTransition(): void {
    if (this.bgTransitionStartTime === 0) return;

    const elapsed = performance.now() - this.bgTransitionStartTime;
    const progress = Math.min(elapsed / BACKGROUND_TRANSITION_DURATION, 1);

    // Apply ease-out timing function: 1 - (1 - t)^2
    const easedProgress = 1 - Math.pow(1 - progress, 2);

    this.currentBgColor = interpolateColor(
      this.bgTransitionFromColor,
      this.bgTransitionToColor,
      easedProgress
    );

    // Clear transition state when complete
    if (progress >= 1) {
      this.bgTransitionStartTime = 0;
      this.currentBgColor = this.bgTransitionToColor;
    }
  }

  /**
   * Check if background transition is in progress
   */
  isBackgroundTransitioning(): boolean {
    return this.bgTransitionStartTime > 0;
  }

  /**
   * Set Dark Mode (dark background)
   * Initiates a smooth background color transition
   * @param enabled - Whether dark mode is enabled
   * @param animate - Whether to animate the transition (default: true)
   *                  Set to false for initial sync to avoid flash
   */
  setDarkMode(enabled: boolean, animate: boolean = true): void {
    if (this.darkModeEnabled === enabled) return;

    this.darkModeEnabled = enabled;

    // Determine target color
    const targetColor = enabled ? DARK_MODE_BACKGROUND : LIGHT_MODE_BACKGROUND;

    if (animate && this.currentBgColor !== targetColor) {
      // Animate transition
      this.bgTransitionFromColor = this.currentBgColor;
      this.bgTransitionToColor = targetColor;
      this.bgTransitionStartTime = performance.now();
    } else {
      // Instant change (for initial sync)
      this.currentBgColor = targetColor;
      this.bgTransitionStartTime = 0;
    }
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
