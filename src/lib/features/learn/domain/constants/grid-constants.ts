/**
 * Grid Constants - Coordinate definitions for Diamond and Box grid modes
 *
 * All coordinates are in percentage units (0-100) for SVG viewBox compatibility.
 * These are used by GridIdentificationQuiz and other grid-related components.
 */

export interface GridPoint {
  x: number;
  y: number;
}

export interface GridPointWithMode extends GridPoint {
  mode: "diamond" | "box" | "both";
}

/**
 * Diamond mode grid points - Cardinal directions (N, E, S, W)
 * Points form a diamond shape on the grid
 */
export const DIAMOND_POINTS: Record<string, GridPoint> = {
  N: { x: 50, y: 15 },
  E: { x: 85, y: 50 },
  S: { x: 50, y: 85 },
  W: { x: 15, y: 50 },
  center: { x: 50, y: 50 },
} as const;

/**
 * Box mode grid points - Intercardinal directions (NE, SE, SW, NW)
 * Points form a box/square shape on the grid
 */
export const BOX_POINTS: Record<string, GridPoint> = {
  NE: { x: 75, y: 25 },
  SE: { x: 75, y: 75 },
  SW: { x: 25, y: 75 },
  NW: { x: 25, y: 25 },
  center: { x: 50, y: 50 },
} as const;

/**
 * All grid points with their associated mode
 * Used for quizzes that need to know which mode each point belongs to
 */
export const ALL_GRID_POINTS: Record<string, GridPointWithMode> = {
  N: { x: 50, y: 15, mode: "diamond" },
  NE: { x: 75, y: 25, mode: "box" },
  E: { x: 85, y: 50, mode: "diamond" },
  SE: { x: 75, y: 75, mode: "box" },
  S: { x: 50, y: 85, mode: "diamond" },
  SW: { x: 25, y: 75, mode: "box" },
  W: { x: 15, y: 50, mode: "diamond" },
  NW: { x: 25, y: 25, mode: "box" },
  center: { x: 50, y: 50, mode: "both" },
} as const;

/**
 * All 8 directional labels (excluding center)
 */
export const GRID_DIRECTIONS = [
  "N",
  "NE",
  "E",
  "SE",
  "S",
  "SW",
  "W",
  "NW",
] as const;

export type GridDirection = (typeof GRID_DIRECTIONS)[number];
