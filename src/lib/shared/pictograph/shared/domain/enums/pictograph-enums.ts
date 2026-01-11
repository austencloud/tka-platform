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

export enum MotionType {
  PRO = "pro",
  ANTI = "anti",
  FLOAT = "float",
  DASH = "dash",
  STATIC = "static",
}

export enum HandMotionType {
  SHIFT = "shift",
  DASH = "dash",
  STATIC = "static",
}

export enum HandPath {
  CLOCKWISE = "cw",
  COUNTER_CLOCKWISE = "ccw",
  DASH = "dash",
  STATIC = "static",
}

/**
 * Skew direction for skewed motions (crossing between cardinal/intercardinal).
 * - PLUS: Motion goes one step further than normal (larger arc)
 * - MINUS: Motion goes one step less than normal (smaller arc)
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

export enum Orientation {
  IN = "in",
  OUT = "out",
  CLOCK = "clock",
  COUNTER = "counter",
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
