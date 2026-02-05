/**
 * Mobile Fullscreen Service Contract
 *
 * Provides intelligent fullscreen management for mobile devices with multiple strategies:
 * 1. PWA detection and "Add to Home Screen" prompts
 * 2. User-triggered fullscreen API
 * 3. Viewport optimization for mobile browsers
 */

export interface IMobileFullscreenManager {
  /**
   * Check if the app is running as a PWA (installed)
   */
  isPWA(): boolean;

  /**
   * Check if the app can be installed as a PWA
   */
  canInstallPWA(): boolean;

  /**
   * Show "Add to Home Screen" prompt if available
   */
  promptInstallPWA(): Promise<boolean>;

  /**
   * Check if fullscreen API is supported
   */
  isFullscreenSupported(): boolean;

  /**
   * Check if currently in fullscreen mode
   */
  isFullscreen(): boolean;

  /**
   * Request fullscreen mode (requires user gesture)
   */
  requestFullscreen(): Promise<boolean>;

  /**
   * Exit fullscreen mode
   */
  exitFullscreen(): Promise<boolean>;

  /**
   * Toggle fullscreen mode
   */
  toggleFullscreen(): Promise<boolean>;

  /**
   * Show a user-friendly fullscreen prompt with options
   */
  showFullscreenPrompt(): void;

  /**
   * Subscribe to fullscreen state changes
   */
  onFullscreenChange(callback: (isFullscreen: boolean) => void): () => void;

  /**
   * Subscribe to PWA install availability changes
   */
  onInstallPromptAvailable(callback: (canInstall: boolean) => void): () => void;

  /**
   * Get the best fullscreen strategy for current device/browser
   */
  getRecommendedStrategy():
    | "pwa"
    | "fullscreen-api"
    | "viewport-only"
    | "not-supported";

  /**
   * Handle PWA installation with automatic fallback to guide
   * Returns true if installation was triggered (native prompt or guide shown)
   */
  handleInstallRequest(): Promise<boolean>;
}
