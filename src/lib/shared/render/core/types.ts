/** Grid locations (8 compass points + center) */
export type GridLocation =
  | "n"
  | "e"
  | "s"
  | "w"
  | "ne"
  | "se"
  | "sw"
  | "nw"
  | "c";

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

export function isCardinal(location: string): boolean {
  return CARDINAL_LOCATIONS.has(location.toLowerCase() as GridLocation);
}

/** Motion types */
export type MotionType = "static" | "pro" | "anti" | "dash" | "float";

/** Prop orientations */
export type Orientation =
  | "in"
  | "out"
  | "clock"
  | "counter"
  // Interradial orientations (Level 4 - 45° between cardinal orientations)
  | "clockIn"
  | "clockOut"
  | "counterIn"
  | "counterOut"
  // Centric orientations (Level 6 - prop at center, points toward compass direction)
  | "centerN"
  | "centerNE"
  | "centerE"
  | "centerSE"
  | "centerS"
  | "centerSW"
  | "centerW"
  | "centerNW";

/** Rotation directions */
export type RotationDirection = "cw" | "ccw" | "no_rot";

/** Prop colors */
export type PropColor = "blue" | "red";

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

/** Hand path directions (movement between locations) */
export type HandPath = "cw" | "ccw" | "dash" | "static" | "hashIn" | "hashOut";

/**
 * The plane in which spinning occurs.
 * - wall: Default TKA grid. Spinning in front of body, viewed head-on.
 * - wheel: Spinning beside body, viewed from the side. Grid rotated 90°.
 * - overhead: Spinning above/below, viewed from above. Grid horizontal.
 *
 * All existing sequences default to "wall" when plane is omitted.
 * Note: Level 4 is interradial orientations. Planes are a separate future concept (Level 8).
 */
export type SpinningPlane = "wall" | "wheel" | "floor";

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
