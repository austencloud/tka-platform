/**
 * PictographConfig - Configuration injection interface
 *
 * Replaces scribe's global singletons (getSettings(), getAnimationVisibilityManager())
 * with an explicit config object. Each consuming app creates its own config implementation:
 *
 * - Scribe wraps its existing singletons
 * - Landing creates a simple config from local state
 *
 * Both get identical rendering behavior.
 */

export interface PictographConfig {
  /** Returns the current blue prop type (e.g. "staff", "fan") */
  getBluePropType: () => string;
  /** Returns the current red prop type (e.g. "staff", "fan") */
  getRedPropType: () => string;
  /** Returns whether dark mode is active */
  getDarkMode: () => boolean;
  /** Base path for SVG assets (e.g. "" for same-origin, or a CDN path) */
  assetBasePath: string;
  /** Optional: Returns whether blue buugeng is flipped (for chirality-based nesting) */
  getBlueBuugengFlipped?: () => boolean;
  /** Optional: Returns whether red buugeng is flipped (for chirality-based nesting) */
  getRedBuugengFlipped?: () => boolean;
}

export const DEFAULT_PICTOGRAPH_CONFIG: PictographConfig = {
  getBluePropType: () => "staff",
  getRedPropType: () => "staff",
  getDarkMode: () => true,
  assetBasePath: "",
};
