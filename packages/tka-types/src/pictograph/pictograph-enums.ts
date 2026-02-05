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
  // Cardinal orientations (radial - relative to center)
  IN = "in",
  OUT = "out",
  CLOCK = "clock",
  COUNTER = "counter",
  // Interradial orientations (Level 6 / poi gravity at intercardinals)
  CLOCK_IN = "clockIn",
  CLOCK_OUT = "clockOut",
  COUNTER_IN = "counterIn",
  COUNTER_OUT = "counterOut",
  // Centric orientations (Level 5 - prop at center, points toward compass direction)
  CENTER_N = "centerN",
  CENTER_NE = "centerNE",
  CENTER_E = "centerE",
  CENTER_SE = "centerSE",
  CENTER_S = "centerS",
  CENTER_SW = "centerSW",
  CENTER_W = "centerW",
  CENTER_NW = "centerNW",
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
