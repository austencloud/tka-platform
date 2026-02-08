/**
 * Shared types for pictograph rendering calculations
 *
 * Uses string literal unions for cross-environment compatibility.
 * Both the browser app and Node.js MCP server can import these.
 */
/** Grid locations (8 compass points + center) */
export type GridLocation = "n" | "e" | "s" | "w" | "ne" | "se" | "sw" | "nw" | "c";
/** Grid rendering modes */
export type GridMode = "diamond" | "box" | "skewed";
/** Cardinal locations (diamond mode hand points) */
export declare const CARDINAL_LOCATIONS: ReadonlySet<GridLocation>;
/** Intercardinal locations (box mode hand points) */
export declare const INTERCARDINAL_LOCATIONS: ReadonlySet<GridLocation>;
/**
 * Check if a location is cardinal (N/E/S/W)
 */
export declare function isCardinal(location: string): boolean;
/** Motion types */
export type MotionType = "static" | "pro" | "anti" | "dash" | "float";
/** Prop orientations */
export type Orientation = "in" | "out" | "clock" | "counter" | "clockIn" | "clockOut" | "counterIn" | "counterOut" | "centerN" | "centerNE" | "centerE" | "centerSE" | "centerS" | "centerSW" | "centerW" | "centerNW";
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
export type HandPath = "cw" | "ccw" | "dash" | "static";
/**
 * The plane in which spinning occurs.
 * - wall: Default TKA grid. Spinning in front of body, viewed head-on.
 * - wheel: Spinning beside body, viewed from the side. Grid rotated 90°.
 * - overhead: Spinning above/below, viewed from above. Grid horizontal.
 *
 * All existing sequences default to "wall" when plane is omitted.
 */
export type SpinningPlane = "wall" | "wheel" | "overhead";
/** Vector directions for offset calculations */
export type VectorDirection = "up" | "down" | "left" | "right" | "upright" | "downright" | "upleft" | "downleft";
