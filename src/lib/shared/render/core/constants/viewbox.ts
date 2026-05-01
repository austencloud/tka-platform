/** Base viewbox size in pixels */
export const VIEWBOX_SIZE = 950;

/** Center point of the viewbox */
export const CENTER = VIEWBOX_SIZE / 2; // 475

// Dark mode colors (bright on dark backgrounds)
export const BLUE_COLOR_DARK = "#3575E2";
export const RED_COLOR_DARK = "#ED1C24";

// Light mode colors (darker on light backgrounds)
export const BLUE_COLOR_LIGHT = "#3D44B8";
export const RED_COLOR_LIGHT = "#DC2626";

/**
 * Overflow ratio for arrow/prop SVGs
 *
 * When converting SVG to canvas, we need to expand the viewBox
 * to capture content that extends beyond the original bounds
 * (arrow tips, prop handles, etc.).
 */
export const SVG_OVERFLOW_RATIO = 0.15;

export const GRID_POINT_COLOR_LIGHT = "#000000";
export const GRID_POINT_COLOR_DARK = "#d0d0d0";
