/**
 * Prop Placement Service Interface
 *
 * Calculates prop placement data for pictograph rendering.
 */


/** Motion visibility passed into placement so that a hidden partner suppresses
 *  this prop's beta offset (no collision → no offset needed). Omitted fields
 *  default to visible. */
export interface PropPlacementVisibility {
  showBlue?: boolean;
  showRed?: boolean;
}

/**
 * Prop SVG Loader Interface
 *
 * Fast, direct SVG loading for props - mirrors arrow loading approach
 */

import type { ThemeMode } from "../../../utils/svg-color-utils";

/**
 * Options for prop SVG loading
 */
export interface PropSvgLoadOptions {
  /** Theme mode for color selection ("dark" or "light"). If not provided, uses global state. */
  themeMode?: ThemeMode;
}

