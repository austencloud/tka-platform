/**
 * Grid coordinate data for pictograph rendering
 *
 * Coordinates are in the 950x950 scene coordinate system with center at (475, 475).
 * All values use "strict" coordinates that match the browser renderer's
 * ArrowGridCoordinator. The browser uses strict points (snapped to cleaner values
 * like ±150 from center) rather than normal points (±143.1 from center).
 * Arrow adjustment JSON values were calibrated against these strict coordinates.
 */

import type { Coordinates, GridLocation, GridMode } from "../types.js";


/**
 * Diamond grid coordinates (cardinal hand points) - STRICT values
 * Hand points are where props are placed for N/E/S/W positions.
 * Uses strict coordinates (±150 from center) matching the browser renderer.
 */
export const DIAMOND_HAND_POINTS: Record<GridLocation, Coordinates | null> = {
  n: { x: 475.0, y: 325.0 },
  e: { x: 625.0, y: 475.0 },
  s: { x: 475.0, y: 625.0 },
  w: { x: 325.0, y: 475.0 },
  // Intercardinal not used in diamond mode for hand points
  ne: null,
  se: null,
  sw: null,
  nw: null,
  c: { x: 475.0, y: 475.0 },
};

/**
 * Diamond grid layer2 points (intercardinal positions) - STRICT values
 * Layer2 points are where arrows are placed.
 * Uses strict coordinates (±150 from center) matching the browser renderer.
 */
export const DIAMOND_LAYER2_POINTS: Record<GridLocation, Coordinates | null> = {
  n: null,
  e: null,
  s: null,
  w: null,
  ne: { x: 625.0, y: 325.0 },
  se: { x: 625.0, y: 625.0 },
  sw: { x: 325.0, y: 625.0 },
  nw: { x: 325.0, y: 325.0 },
  c: { x: 475.0, y: 475.0 },
};

/**
 * Box grid coordinates (intercardinal hand points) - STRICT values
 * Hand points for NE/SE/SW/NW positions.
 * Uses strict coordinates matching the browser renderer.
 */
export const BOX_HAND_POINTS: Record<GridLocation, Coordinates | null> = {
  n: null,
  e: null,
  s: null,
  w: null,
  ne: { x: 581.1, y: 368.9 },
  se: { x: 581.1, y: 581.1 },
  sw: { x: 368.9, y: 581.1 },
  nw: { x: 368.9, y: 368.9 },
  c: { x: 475.0, y: 475.0 },
};

/**
 * Box grid layer2 points (cardinal positions) - STRICT values
 * Layer2 points for N/E/S/W arrow placement.
 * Uses strict coordinates matching the browser renderer.
 */
export const BOX_LAYER2_POINTS: Record<GridLocation, Coordinates | null> = {
  n: { x: 475, y: 262.9 },
  e: { x: 687.1, y: 475 },
  s: { x: 475, y: 687.1 },
  w: { x: 262.9, y: 475 },
  ne: null,
  se: null,
  sw: null,
  nw: null,
  c: { x: 475.0, y: 475.0 },
};

/**
 * Outer points (for grid rendering)
 */
export const DIAMOND_OUTER_POINTS: Readonly<Record<string, Coordinates>> = {
  n: { x: 475, y: 175 },
  e: { x: 775, y: 475 },
  s: { x: 475, y: 775 },
  w: { x: 175, y: 475 },
};

export const BOX_OUTER_POINTS: Readonly<Record<string, Coordinates>> = {
  ne: { x: 687.1, y: 262.9 },
  se: { x: 687.1, y: 687.1 },
  sw: { x: 262.9, y: 687.1 },
  nw: { x: 262.9, y: 262.9 },
};

/** Center point */
export const CENTER_POINT: Coordinates = { x: 475.0, y: 475.0 };


/**
 * Fallback hand point coordinates when mode-specific lookup fails - STRICT values
 */
export const FALLBACK_HAND_POINTS: Readonly<Record<GridLocation, Coordinates>> = {
  n: { x: 475, y: 325.0 },
  e: { x: 625.0, y: 475 },
  s: { x: 475, y: 625.0 },
  w: { x: 325.0, y: 475 },
  ne: { x: 581.1, y: 368.9 },
  se: { x: 581.1, y: 581.1 },
  sw: { x: 368.9, y: 581.1 },
  nw: { x: 368.9, y: 368.9 },
  c: { x: 475.0, y: 475.0 },
};

/**
 * Fallback layer2 point coordinates - STRICT values
 */
export const FALLBACK_LAYER2_POINTS: Readonly<Record<GridLocation, Coordinates>> = {
  n: { x: 475, y: 262.9 },
  e: { x: 687.1, y: 475 },
  s: { x: 475, y: 687.1 },
  w: { x: 262.9, y: 475 },
  ne: { x: 625.0, y: 325.0 },
  se: { x: 625.0, y: 625.0 },
  sw: { x: 325.0, y: 625.0 },
  nw: { x: 325.0, y: 325.0 },
  c: { x: 475.0, y: 475.0 },
};
