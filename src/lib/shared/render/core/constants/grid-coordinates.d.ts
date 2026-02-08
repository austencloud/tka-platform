/**
 * Grid coordinate data for pictograph rendering
 *
 * Coordinates are in the 950x950 scene coordinate system with center at (475, 475).
 * This is the single source of truth for all grid positioning.
 */
import type { Coordinates, GridLocation } from "../types.js";
/**
 * Diamond grid coordinates (cardinal hand points)
 * Hand points are where props are placed for N/E/S/W positions
 */
export declare const DIAMOND_HAND_POINTS: Record<GridLocation, Coordinates | null>;
/**
 * Diamond grid layer2 points (intercardinal positions)
 * Layer2 points are where arrows are placed
 */
export declare const DIAMOND_LAYER2_POINTS: Record<GridLocation, Coordinates | null>;
/**
 * Box grid coordinates (intercardinal hand points)
 * Hand points for NE/SE/SW/NW positions
 */
export declare const BOX_HAND_POINTS: Record<GridLocation, Coordinates | null>;
/**
 * Box grid layer2 points (cardinal positions)
 * Layer2 points for N/E/S/W arrow placement
 */
export declare const BOX_LAYER2_POINTS: Record<GridLocation, Coordinates | null>;
/**
 * Outer points (for grid rendering)
 */
export declare const DIAMOND_OUTER_POINTS: Readonly<Record<string, Coordinates>>;
export declare const BOX_OUTER_POINTS: Readonly<Record<string, Coordinates>>;
/** Center point */
export declare const CENTER_POINT: Coordinates;
/**
 * Fallback hand point coordinates when mode-specific lookup fails
 */
export declare const FALLBACK_HAND_POINTS: Readonly<Record<GridLocation, Coordinates>>;
/**
 * Fallback layer2 point coordinates
 */
export declare const FALLBACK_LAYER2_POINTS: Readonly<Record<GridLocation, Coordinates>>;
