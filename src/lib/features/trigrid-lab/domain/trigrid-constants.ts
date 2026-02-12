/**
 * Trigrid Lab Constants
 *
 * Core constants for the 3-point equilateral triangle grid.
 */

/** Arc angle between adjacent vertices on the trigrid */
export const TRIGRID_ARC_ANGLE = 120;

/** Number of vertices on the trigrid */
export const TRIGRID_POINT_COUNT = 3;

/** SVG canvas dimensions */
export const TRIGRID_SVG_SIZE = 950;

/** Center of the SVG canvas */
export const TRIGRID_CENTER_X = 475;
export const TRIGRID_CENTER_Y = 475;

/** Radius from center to hand points (vertices) */
export const TRIGRID_HAND_POINT_RADIUS = 143;

/** Radius from center to outer marker dots */
export const TRIGRID_OUTER_MARKER_RADIUS = 300;

/** Hand point circle radius */
export const TRIGRID_HAND_POINT_SIZE = 8;

/** Outer marker circle radius */
export const TRIGRID_OUTER_MARKER_SIZE = 6;

/** Prop SVG render size */
export const TRIGRID_PROP_SIZE = 80;

/** Arrow stroke width */
export const TRIGRID_ARROW_STROKE_WIDTH = 3;

/** Arrowhead size (length from tip to base) */
export const TRIGRID_ARROWHEAD_SIZE = 12;

/**
 * Letter types available on the trigrid.
 * No dashes exist (no opposite points), so Types 3, 4, 5 are excluded.
 */
export const TRIGRID_AVAILABLE_LETTER_TYPES = [1, 2, 6] as const;

/**
 * Orientation step size in degrees on the trigrid.
 * Each step in the 6-point orientation cycle = 60 degrees.
 */
export const TRIGRID_ORIENTATION_STEP = 60;

/**
 * Perpendicular offset distance (in SVG pixels) for props sharing a beta vertex.
 * Matches the existing 4-point grid's default: 950 / 45 ≈ 21px.
 */
export const TRIGRID_BETA_OFFSET_DISTANCE = 21;
