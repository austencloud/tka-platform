import type { ViewportMode } from "../../domain/enums/ViewportMode";
import type { ViewportState } from "../../domain/models/ViewportState";

/**
 * Service for managing viewport state and responsive behavior
 */
export interface INavigationViewportManager {
  /**
   * Get current viewport state including dimensions and safe areas
   */
  getViewportState(): ViewportState;

  /**
   * Determine the appropriate mode based on viewport dimensions
   */
  determineViewportMode(width: number, height: number): ViewportMode;

  /**
   * Check if viewport is in mobile mode
   */
  isMobileViewport(): boolean;

  /**
   * Check if viewport is in desktop mode
   */
  isDesktopViewport(): boolean;

  /**
   * Subscribe to viewport changes
   * @param callback Function to call when viewport state changes
   * @returns Unsubscribe function
   */
  onViewportChange(callback: (state: ViewportState) => void): () => void;

  /**
   * Calculate safe area insets for current device
   */
  calculateSafeAreaInsets(): {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };

  /**
   * Get viewport dimensions with safe area considerations
   */
  getViewportDimensions(): { width: number; height: number };
}
