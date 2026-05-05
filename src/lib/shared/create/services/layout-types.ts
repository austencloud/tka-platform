/**
 * Layout type definitions for responsive layout management.
 *
 * Extracted from features/create/shared/orchestration/types to allow
 * shared/ services to use these types without reverse-importing from features/.
 */

/**
 * Layout configuration for responsive layout management
 */
export interface LayoutConfiguration {
  /** Navigation layout position: top for desktop/tablet, left for landscape mobile, bottom for portrait mobile */
  navigationLayout: "top" | "left" | "bottom";

  /** Whether panels should be side-by-side (true) or stacked (false) */
  shouldUseSideBySideLayout: boolean;

  /** Current viewport width in pixels */
  viewportWidth: number;

  /** Current viewport height in pixels */
  viewportHeight: number;

  /** Whether device is detected as desktop */
  isDesktop: boolean;

  /** Whether device is in landscape mobile mode */
  isLandscapeMobile: boolean;

  /** Aspect ratio (width / height) */
  aspectRatio: number;

  /** Whether device is likely Z Fold unfolded */
  isLikelyZFoldUnfolded: boolean;
}
