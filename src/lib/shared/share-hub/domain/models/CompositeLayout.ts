/**
 * CompositeLayout.ts
 *
 * Defines the layout configuration for Composite mode export.
 * User can combine two media pieces (animation, static grid, or performance video)
 * in either horizontal (side-by-side) or vertical (stacked) orientation.
 *
 * Examples:
 * - Animation + Grid (horizontal)
 * - Static + Performance (vertical)
 * - Animation + Performance (horizontal)
 *
 * Domain: Share Hub - Composite Mode Configuration
 */

export interface CompositeLayout {
  /** Orientation of the two pieces */
  orientation: "horizontal" | "vertical";

  /** First media piece (left or top) */
  piece1: "animation" | "static";

  /** Second media piece (right or bottom) */
  piece2: "grid" | "performance";
}

/**
 * Default composite layout configuration
 */
export const DEFAULT_COMPOSITE_LAYOUT: CompositeLayout = {
  orientation: "horizontal",
  piece1: "animation",
  piece2: "grid",
};
