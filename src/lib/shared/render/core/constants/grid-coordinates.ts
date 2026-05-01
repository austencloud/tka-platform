import type { Coordinates, GridLocation, GridMode } from "../types.js";

/**
 * Diamond grid coordinates (cardinal hand points)
 * Hand points are where props are placed for N/E/S/W positions
 */
export const DIAMOND_HAND_POINTS: Record<GridLocation, Coordinates | null> = {
  n: { x: 475.0, y: 331.9 },
  e: { x: 618.1, y: 475.0 },
  s: { x: 475.0, y: 618.1 },
  w: { x: 331.9, y: 475.0 },
  // Intercardinal not used in diamond mode for hand points
  ne: null,
  se: null,
  sw: null,
  nw: null,
  c: { x: 475.0, y: 475.0 },
};

/**
 * Diamond grid layer2 points (intercardinal positions)
 * Layer2 points are where arrows are placed
 */
export const DIAMOND_LAYER2_POINTS: Record<GridLocation, Coordinates | null> = {
  n: null,
  e: null,
  s: null,
  w: null,
  ne: { x: 618.1, y: 331.9 },
  se: { x: 618.1, y: 618.1 },
  sw: { x: 331.9, y: 618.1 },
  nw: { x: 331.9, y: 331.9 },
  c: { x: 475.0, y: 475.0 },
};

/**
 * Box grid coordinates (intercardinal hand points)
 * Hand points for NE/SE/SW/NW positions
 */
export const BOX_HAND_POINTS: Record<GridLocation, Coordinates | null> = {
  n: null,
  e: null,
  s: null,
  w: null,
  ne: { x: 576.2, y: 373.8 },
  se: { x: 576.2, y: 576.2 },
  sw: { x: 373.8, y: 576.2 },
  nw: { x: 373.8, y: 373.8 },
  c: { x: 475.0, y: 475.0 },
};

/**
 * Box grid layer2 points (cardinal positions)
 * Layer2 points for N/E/S/W arrow placement
 */
export const BOX_LAYER2_POINTS: Record<GridLocation, Coordinates | null> = {
  n: { x: 475, y: 272.6 },
  e: { x: 677.4, y: 475 },
  s: { x: 475, y: 677.4 },
  w: { x: 272.6, y: 475 },
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
 * Fallback hand point coordinates when mode-specific lookup fails
 */
export const FALLBACK_HAND_POINTS: Readonly<Record<GridLocation, Coordinates>> = {
  n: { x: 475, y: 331.9 },
  e: { x: 618.1, y: 475 },
  s: { x: 475, y: 618.1 },
  w: { x: 331.9, y: 475 },
  ne: { x: 576.2, y: 373.8 },
  se: { x: 576.2, y: 576.2 },
  sw: { x: 373.8, y: 576.2 },
  nw: { x: 373.8, y: 373.8 },
  c: { x: 475.0, y: 475.0 },
};

/**
 * Fallback layer2 point coordinates
 */
export const FALLBACK_LAYER2_POINTS: Readonly<Record<GridLocation, Coordinates>> = {
  n: { x: 475, y: 272.6 },
  e: { x: 677.4, y: 475 },
  s: { x: 475, y: 677.4 },
  w: { x: 272.6, y: 475 },
  ne: { x: 618.1, y: 331.9 },
  se: { x: 618.1, y: 618.1 },
  sw: { x: 331.9, y: 618.1 },
  nw: { x: 331.9, y: 331.9 },
  c: { x: 475.0, y: 475.0 },
};
