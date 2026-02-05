/**
 * Layout State Models
 *
 * Type definitions for layout state and configuration.
 */

/**
 * Layout breakpoints for responsive design
 */
export const LAYOUT_BREAKPOINTS = {
  /** Minimum width for wide viewport (desktop side-by-side) */
  WIDE_VIEWPORT: 1024,

  /** Aspect ratio threshold for landscape detection */
  LANDSLOOPE_ASPECT_RATIO: 1.2,

  /** Z Fold minimum width */
  Z_FOLD_MIN_WIDTH: 750,

  /** Z Fold maximum width */
  Z_FOLD_MAX_WIDTH: 950,

  /** Z Fold minimum aspect ratio */
  Z_FOLD_MIN_ASPECT: 1.1,

  /** Z Fold maximum aspect ratio */
  Z_FOLD_MAX_ASPECT: 1.4,
} as const;

/**
 * Layout mode for panel arrangement
 */
export type LayoutMode = "side-by-side" | "stacked";

/**
 * Navigation layout position
 */
export type NavigationLayout = "top" | "left";

/**
 * Device type for layout decisions
 */
export type DeviceType = "desktop" | "tablet" | "mobile" | "mobile-landscape";

/**
 * Layout decision factors
 */
export interface LayoutDecisionFactors {
  isDesktop: boolean;
  hasWideViewport: boolean;
  isLandscapeMobile: boolean;
  isLikelyZFoldUnfolded: boolean;
  isSignificantlyLandscape: boolean;
  aspectRatio: number;
  viewportWidth: number;
  viewportHeight: number;
}

/**
 * Layout change event data
 */
export interface LayoutChangeEvent {
  previousLayout: LayoutMode;
  newLayout: LayoutMode;
  factors: LayoutDecisionFactors;
  timestamp: number;
}
