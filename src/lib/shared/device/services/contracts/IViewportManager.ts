/**
 * Viewport Service Contract
 *
 * Provides reactive viewport dimensions and related utilities.
 */
export interface IViewportManager {
  /**
   * Current viewport width (reactive)
   */
  readonly width: number;

  /**
   * Current viewport height (reactive)
   */
  readonly height: number;

  /**
   * Whether the viewport service has been initialized
   */
  readonly isInitialized: boolean;

  /**
   * Subscribe to viewport changes
   * @param callback Function to call when viewport changes
   * @returns Unsubscribe function
   */
  onViewportChange(callback: () => void): () => void;

  /**
   * Get the current aspect ratio (width / height)
   */
  getAspectRatio(): number;

  /**
   * Check if viewport is in landscape orientation
   */
  isLandscape(): boolean;

  /**
   * Check if viewport is in portrait orientation
   */
  isPortrait(): boolean;
}
