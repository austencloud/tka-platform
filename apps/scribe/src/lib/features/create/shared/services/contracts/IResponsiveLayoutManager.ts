/**
 * Responsive Layout Service Contract
 *
 * Manages responsive layout decisions for two-panel interfaces:
 * - Panel arrangement (side-by-side vs stacked)
 * - Viewport tracking and dimensions
 * - Device type detection for layout optimization
 * - Navigation bar positioning
 *
 * Domain: Create module - Sequence Construction Interface
 */

import type { LayoutConfiguration } from "../../orchestration/types";

export interface IResponsiveLayoutManager {
  /**
   * Initialize the service and start tracking viewport changes
   */
  initialize(): void;

  /**
   * Clean up subscriptions and observers
   */
  dispose(): void;

  /**
   * Get current viewport width
   */
  getViewportWidth(): number;

  /**
   * Get current viewport height
   */
  getViewportHeight(): number;

  /**
   * Get current navigation layout (top or left)
   */
  getNavigationLayout(): "top" | "left";

  /**
   * Determine if CreateModule panels should use side-by-side layout
   * (Workspace left, Tool Panel right) vs stacked layout (Workspace top, Tool Panel bottom)
   * Based on device type, orientation, and viewport size
   */
  shouldUseSideBySideLayout(): boolean;

  /**
   * Check if current layout is mobile portrait mode
   * Inverse of shouldUseSideBySideLayout() - useful for UI logic that needs to know
   * if we're in mobile portrait stacked layout
   */
  isMobilePortrait(): boolean;

  /**
   * Check if device is desktop
   */
  isDesktop(): boolean;

  /**
   * Check if device is landscape mobile
   */
  isLandscapeMobile(): boolean;

  /**
   * Check if viewport is wide enough for side-by-side layout
   */
  hasWideViewport(): boolean;

  /**
   * Subscribe to layout changes
   * @param callback Called when layout configuration changes
   * @returns Unsubscribe function
   */
  onLayoutChange(callback: (config: LayoutConfiguration) => void): () => void;
  calculateLayout(): LayoutConfiguration;

  /**
   * Get aspect ratio of current viewport
   */
  getAspectRatio(): number;

  /**
   * Detect if device is likely a Z Fold in unfolded state
   */
  isLikelyZFoldUnfolded(): boolean;
}
