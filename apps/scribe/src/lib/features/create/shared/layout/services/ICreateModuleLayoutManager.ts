/**
 * CreateModule Layout Service Interface
 *
 * Contract for managing responsive layout calculations and viewport monitoring.
 */

import type { LayoutConfiguration } from "../../orchestration/types";

export interface ICreateModuleLayoutManager {
  /**
   * Calculate current layout configuration based on device and viewport
   * @returns Current layout configuration
   */
  calculateLayoutConfiguration(): LayoutConfiguration;

  /**
   * Subscribe to layout configuration changes
   * @param callback Function to call when layout changes
   * @returns Unsubscribe function
   */
  subscribeToLayoutChanges(
    callback: (config: LayoutConfiguration) => void
  ): () => void;

  /**
   * Get current viewport dimensions
   * @returns Object with width and height
   */
  getViewportDimensions(): { width: number; height: number };

  /**
   * Check if device is likely Z Fold unfolded
   * @param width Viewport width
   * @param aspectRatio Aspect ratio
   * @returns True if likely Z Fold unfolded
   */
  isZFoldUnfolded(width: number, aspectRatio: number): boolean;

  /**
   * Determine if should use side-by-side layout
   * @param config Layout configuration
   * @returns True if side-by-side layout should be used
   */
  shouldUseSideBySideLayout(config: LayoutConfiguration): boolean;
}
