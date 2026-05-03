
/**
 * Reactive Viewport Service
 *
 * Provides reactive viewport dimensions using browser APIs.
 * Automatically updates when window is resized.
 */
export class ViewportManager {
  private _width: number = 0;
  private _height: number = 0;
  private _isInitialized: boolean = false;
  private _callbacks: (() => void)[] = [];
  private _resizeTimeout: number | null = null;

  constructor() {
    // Initialize viewport dimensions if window is available
    if (typeof window !== "undefined") {
      // Set initial dimensions immediately for early device detection
      this._width = window.innerWidth;
      this._height = window.innerHeight;
      this._isInitialized = true;

      // Set up resize listener
      this.setupResizeListener();

      // CRITICAL FIX: Multi-stage dimension verification for Chrome DevTools mobile emulation
      // DevTools emulation can take multiple frames to stabilize, especially during HMR
      // Check dimensions at 0ms (immediate), 50ms, and 100ms to catch delayed updates
      const checkDimensions = () => {
        const newWidth = window.innerWidth;
        const newHeight = window.innerHeight;

        // If dimensions changed, update and notify subscribers
        if (newWidth !== this._width || newHeight !== this._height) {
          this._width = newWidth;
          this._height = newHeight;

          // Notify all callbacks about corrected dimensions
          this._callbacks.forEach((callback) => callback());
        }
      };

      // Check on next frame
      requestAnimationFrame(checkDimensions);

      // Also check after small delays to catch HMR-induced changes
      setTimeout(checkDimensions, 50);
      setTimeout(checkDimensions, 100);
    }
  }

  get width(): number {
    return this._width;
  }

  get height(): number {
    return this._height;
  }

  get isInitialized(): boolean {
    return this._isInitialized;
  }

  private setupResizeListener(): void {
    const handleResize = () => {
      // Clear any existing timeout
      if (this._resizeTimeout !== null) {
        clearTimeout(this._resizeTimeout);
      }

      // Debounce resize events to prevent layout thrashing during device rotation
      this._resizeTimeout = window.setTimeout(() => {
        this._width = window.innerWidth;
        this._height = window.innerHeight;

        // Notify all callbacks
        this._callbacks.forEach((callback) => callback());

        this._resizeTimeout = null;
      }, 50); // 50ms debounce delay for snappy response while preventing excessive updates
    };

    window.addEventListener("resize", handleResize);
  }

  // Subscribe to viewport changes
  onViewportChange(callback: () => void): () => void {
    this._callbacks.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this._callbacks.indexOf(callback);
      if (index > -1) {
        this._callbacks.splice(index, 1);
      }
    };
  }

  // Helper methods for common viewport queries
  getAspectRatio(): number {
    return this._height > 0 ? this._width / this._height : 1;
  }

  isLandscape(): boolean {
    return this._width > this._height;
  }

  isPortrait(): boolean {
    return this._height > this._width;
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
export const viewportManager = new ViewportManager();
