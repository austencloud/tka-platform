/**
 * Viewbox constants for pictograph rendering
 *
 * All pictographs are rendered in a 950x950 coordinate system.
 * Both renderers (Canvas2D and MCP) scale from this base size.
 */
/** Base viewbox size in pixels */
export declare const VIEWBOX_SIZE = 950;
/** Center point of the viewbox */
export declare const CENTER: number;
export declare const BLUE_COLOR_DARK = "#3575E2";
export declare const RED_COLOR_DARK = "#ED1C24";
export declare const BLUE_COLOR_LIGHT = "#3D44B8";
export declare const RED_COLOR_LIGHT = "#DC2626";
/**
 * Overflow ratio for arrow/prop SVGs
 *
 * When converting SVG to canvas, we need to expand the viewBox
 * to capture content that extends beyond the original bounds
 * (arrow tips, prop handles, etc.).
 */
export declare const SVG_OVERFLOW_RATIO = 0.15;
export declare const GRID_POINT_COLOR_LIGHT = "#000000";
export declare const GRID_POINT_COLOR_DARK = "#d0d0d0";
