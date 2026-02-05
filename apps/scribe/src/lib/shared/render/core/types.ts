/**
 * Shared types for pictograph rendering calculations
 *
 * Uses string literal unions for cross-environment compatibility.
 * Both the browser app and Node.js MCP server can import these.
 */

// ============================================================================
// GRID TYPES
// ============================================================================

/** Grid locations (8 compass points) */
export type GridLocation =
  | "n"
  | "e"
  | "s"
  | "w"
  | "ne"
  | "se"
  | "sw"
  | "nw";

/** Grid rendering modes */
export type GridMode = "diamond" | "box" | "skewed";

/** Cardinal locations (diamond mode hand points) */
export const CARDINAL_LOCATIONS: ReadonlySet<GridLocation> = new Set([
  "n",
  "e",
  "s",
  "w",
]);

/** Intercardinal locations (box mode hand points) */
export const INTERCARDINAL_LOCATIONS: ReadonlySet<GridLocation> = new Set([
  "ne",
  "se",
  "sw",
  "nw",
]);

/**
 * Check if a location is cardinal (N/E/S/W)
 */
export function isCardinal(location: string): boolean {
  return CARDINAL_LOCATIONS.has(location.toLowerCase() as GridLocation);
}

// ============================================================================
// MOTION TYPES
// ============================================================================

/** Motion types */
export type MotionType = "static" | "pro" | "anti" | "dash" | "float";

/** Prop orientations */
export type Orientation =
  | "in"
  | "out"
  | "clock"
  | "counter"
  // Interradial orientations (Level 6 / poi)
  | "clock_in"
  | "clock_out"
  | "counter_in"
  | "counter_out";

/** Rotation directions */
export type RotationDirection = "cw" | "ccw" | "no_rot";

/** Prop colors */
export type PropColor = "blue" | "red";

// ============================================================================
// COORDINATE TYPES
// ============================================================================

/** 2D coordinates */
export interface Coordinates {
  x: number;
  y: number;
}

/** Prop placement result */
export interface PropPlacement {
  x: number;
  y: number;
  rotation: number;
}

/** Arrow placement result */
export interface ArrowPlacement {
  x: number;
  y: number;
  rotation: number;
  location: GridLocation;
}

// ============================================================================
// HAND PATH
// ============================================================================

/** Hand path directions (movement between locations) */
export type HandPath = "cw" | "ccw" | "dash" | "static";

// ============================================================================
// VECTOR DIRECTIONS (for beta offset)
// ============================================================================

/** Vector directions for offset calculations */
export type VectorDirection =
  | "up"
  | "down"
  | "left"
  | "right"
  | "upright"
  | "downright"
  | "upleft"
  | "downleft";
