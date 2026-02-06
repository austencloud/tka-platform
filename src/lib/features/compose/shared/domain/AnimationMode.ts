/**
 * Animation Mode Types
 *
 * Defines the different animation modes available in the Animate module.
 * Each mode determines how sequences are displayed and animated.
 */

/**
 * Available animation modes
 *
 * - single: Display a single sequence
 * - tunnel: Display sequences in a tunnel/wave pattern
 * - mirror: Display sequences mirrored horizontally
 * - grid: Display sequences in a grid layout
 * - side-by-side: Display two sequences side-by-side for comparison
 */
export type AnimationMode =
  | "single"
  | "tunnel"
  | "mirror"
  | "grid"
  | "side-by-side";

/**
 * Default animation mode
 */
export const DEFAULT_ANIMATION_MODE: AnimationMode = "single";
