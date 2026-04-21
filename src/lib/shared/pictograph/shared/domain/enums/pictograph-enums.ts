/**
 * Core Domain Enums
 *
 * All enumeration types used throughout the TKA domain models.
 * Centralized location for type-safe constants and values.
 * Based on modern desktop app's enums.py
 */

export enum VTGTiming {
  TOG = "tog",
  SPLIT = "split",
  QUARTER = "quarter",
  NONE = "none",
}

export enum VTGDirection {
  SAME = "same",
  OPP = "opp",
  NONE = "none",
}

export const MotionType = {
  PRO: "pro",
  ANTI: "anti",
  FLOAT: "float",
  DASH: "dash",
  STATIC: "static",
} as const;

export type MotionType = (typeof MotionType)[keyof typeof MotionType];

export enum HandMotionType {
  SHIFT = "shift",
  DASH = "dash",
  STATIC = "static",
  HASH_IN = "hashIn",   // Perimeter → center
  HASH_OUT = "hashOut", // Center → perimeter
}

export enum HandPath {
  CLOCKWISE = "cw",
  COUNTER_CLOCKWISE = "ccw",
  DASH = "dash",
  STATIC = "static",
  // Hash (dash-): shortened dash to/from center. Same geometry and rotation rules as dash.
  HASH_IN = "hashIn", // perimeter → center
  HASH_OUT = "hashOut", // center → perimeter
}

/**
 * Path length modifier for shifts and dashes.
 *
 * For dashes (L4+): modifies straight-line distance.
 *
 * For shifts (L5+): modifies arc length on 8-point grid.
 *   - PLUS (skew+): Extended arc (e.g., S to NE, spanning 3 segments)
 *   - MINUS (skew-): Shortened arc (less than one standard segment)
 *   - PLUS (dash+, L6): Extended to cross-grid destination
 *   - MINUS (dash-): Shortened to center = hash
 *
 * Displayed per-hand in the turns column of the TKA glyph.
 */
export enum SkewDirection {
  PLUS = "+",
  MINUS = "-",
}

export enum MotionColor {
  BLUE = "blue",
  RED = "red",
}

export enum RotationDirection {
  CLOCKWISE = "cw",
  COUNTER_CLOCKWISE = "ccw",
  NO_ROTATION = "noRotation",
}

/**
 * Orientation describes the direction a prop points relative to the center.
 *
 * Cardinal orientations (Level 1-5):
 * - IN: Points toward center
 * - OUT: Points away from center
 * - CLOCK: Perpendicular, 90° clockwise from radial
 * - COUNTER: Perpendicular, 90° counter-clockwise from radial
 *
 * Interradial orientations (Level 6 - 45° between cardinal orientations):
 * - CLOCK_IN: Between CLOCK and IN (gravity at NE)
 * - CLOCK_OUT: Between CLOCK and OUT (gravity at SE)
 * - COUNTER_IN: Between COUNTER and IN (gravity at NW)
 * - COUNTER_OUT: Between COUNTER and OUT (gravity at SW)
 */
export enum Orientation {
  // Cardinal orientations (radial - relative to center)
  IN = "in",
  OUT = "out",
  // Non-radial orientations (Level 3)
  CLOCK = "clock",
  COUNTER = "counter", 
  // Centric orientations (Level 5 - prop at center, points toward compass direction)
  CENTER_N = "centerN",
  CENTER_NE = "centerNE",
  CENTER_E = "centerE",
  CENTER_SE = "centerSE",
  CENTER_S = "centerS",
  CENTER_SW = "centerSW",
  CENTER_W = "centerW",
  CENTER_NW = "centerNW",
  // Interradial orientations (Level 6)
  CLOCK_IN = "clockIn",
  CLOCK_OUT = "clockOut",
  COUNTER_IN = "counterIn",
  COUNTER_OUT = "counterOut",
}

export enum VectorDirection {
  UP = "up",
  DOWN = "down",
  LEFT = "left",
  RIGHT = "right",
  UPRIGHT = "upright",
  DOWNRIGHT = "downright",
  UPLEFT = "upleft",
  DOWNLEFT = "downleft",
}

export enum VTGMode {
  SPLIT_SAME = "SS",
  SPLIT_OPP = "SO",
  TOG_SAME = "TS",
  TOG_OPP = "TO",
  QUARTER_SAME = "QS",
  QUARTER_OPP = "QO",
}

export enum ElementalType {
  WATER = "water",
  FIRE = "fire",
  EARTH = "earth",
  AIR = "air",
  SUN = "sun",
  MOON = "moon",
}

export enum GlyphType {
  TKA = "tka",
  REVERSALS = "reversals",
  VTG = "vtg",
  ELEMENTAL = "elemental",
  POSITIONS = "positions",
}
