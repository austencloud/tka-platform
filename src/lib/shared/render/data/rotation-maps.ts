/**
 * Rotation Maps for Canvas 2D Direct Renderer
 *
 * Ported from the SVG rendering system's rotation configuration files.
 * All angles are in degrees, keyed by GridLocation enum values.
 */

// Grid location string values (matching GridLocation enum)
type Location = "n" | "e" | "s" | "w" | "ne" | "se" | "sw" | "nw";
type LocationMap = Record<Location, number>;
type RotationDirection = "cw" | "ccw";

export interface RotationMaps {
  static: {
    radial: Record<RotationDirection, LocationMap>;
    nonradial: Record<RotationDirection, LocationMap>;
    // Override maps for special cases (when rotation_override flag is set)
    radialOverride: Record<Location, Record<RotationDirection, number>>;
    nonradialOverride: Record<Location, Record<RotationDirection, number>>;
  };
  pro: Record<RotationDirection, LocationMap>;
  anti: Record<RotationDirection, LocationMap>;
  float: Record<RotationDirection, LocationMap>;
  dash: {
    cw: LocationMap;
    ccw: LocationMap;
    noRotation: Record<string, number>; // Key: "startLoc,endLoc"
  };
}

/**
 * Complete rotation lookup tables for all motion types.
 *
 * Usage:
 *   const angle = ROTATION_MAPS.pro.cw["ne"]; // Returns 0
 *   const angle = ROTATION_MAPS.static.radial.cw["n"]; // Returns 0
 */
export const ROTATION_MAPS: RotationMaps = {
  // ============================================================
  // STATIC ARROWS
  // ============================================================
  static: {
    // Radial orientations (IN/OUT) - Used in Diamond Mode
    radial: {
      cw: {
        n: 0,
        e: 90,
        s: 180,
        w: 270,
        ne: 45,
        se: 135,
        sw: 225,
        nw: 315,
      },
      ccw: {
        n: 0,
        e: 90,
        s: 180,
        w: 270,
        ne: 45,
        se: 135,
        sw: 225,
        nw: 315,
      },
    },
    // Non-radial orientations (CLOCK/COUNTER) - Used in Box Mode
    nonradial: {
      cw: {
        n: 180,
        e: 270,
        s: 0,
        w: 90,
        ne: 225,
        se: 315,
        sw: 45,
        nw: 135,
      },
      ccw: {
        n: 180,
        e: 270,
        s: 0,
        w: 90,
        ne: 225,
        se: 315,
        sw: 45,
        nw: 135,
      },
    },
    // Override maps for special pictograph configurations
    radialOverride: {
      n: { cw: 180, ccw: 180 },
      e: { cw: 270, ccw: 270 },
      s: { cw: 0, ccw: 0 },
      w: { cw: 90, ccw: 90 },
      ne: { cw: 135, ccw: 135 },
      se: { cw: 45, ccw: 45 },
      sw: { cw: 315, ccw: 315 },
      nw: { cw: 225, ccw: 225 },
    },
    nonradialOverride: {
      n: { cw: 0, ccw: 0 },
      e: { cw: 90, ccw: 90 },
      s: { cw: 180, ccw: 180 },
      w: { cw: 270, ccw: 270 },
      ne: { cw: 45, ccw: 315 },
      se: { cw: 135, ccw: 225 },
      sw: { cw: 225, ccw: 135 },
      nw: { cw: 315, ccw: 45 },
    },
  },

  // ============================================================
  // PRO ARROWS
  // ============================================================
  pro: {
    cw: {
      n: 315,
      e: 45,
      s: 135,
      w: 225,
      ne: 0,
      se: 90,
      sw: 180,
      nw: 270,
    },
    ccw: {
      n: 45,
      e: 135,
      s: 225,
      w: 315,
      ne: 90,
      se: 180,
      sw: 270,
      nw: 0,
    },
  },

  // ============================================================
  // ANTI ARROWS
  // Anti clockwise = PRO counter-clockwise
  // Anti counter-clockwise = PRO clockwise
  // ============================================================
  anti: {
    cw: {
      n: 45,
      e: 135,
      s: 225,
      w: 315,
      ne: 90,
      se: 180,
      sw: 270,
      nw: 0,
    },
    ccw: {
      n: 315,
      e: 45,
      s: 135,
      w: 225,
      ne: 0,
      se: 90,
      sw: 180,
      nw: 270,
    },
  },

  // ============================================================
  // FLOAT ARROWS
  // Based on HANDPATH DIRECTION (not prop rotation direction)
  // Clockwise handpath: S→W, W→N, N→E, E→S, NE→SE, SE→SW, SW→NW, NW→NE
  // Counter-clockwise handpath: W→S, N→W, E→N, S→E, NE→NW, NW→SW, SW→SE, SE→NE
  // ============================================================
  float: {
    cw: {
      n: 315,
      e: 45,
      s: 135,
      w: 225,
      ne: 0,
      se: 90,
      sw: 180,
      nw: 270,
    },
    ccw: {
      n: 135,
      e: 225,
      s: 315,
      w: 45,
      ne: 180,
      se: 270,
      sw: 0,
      nw: 90,
    },
  },

  // ============================================================
  // DASH ARROWS
  // Includes special handling for NO_ROTATION cases
  // ============================================================
  dash: {
    cw: {
      n: 0,
      e: 90,
      s: 180,
      w: 270,
      ne: 45,
      se: 135,
      sw: 225,
      nw: 315,
    },
    ccw: {
      n: 0,
      e: 90,
      s: 180,
      w: 270,
      ne: 45,
      se: 135,
      sw: 225,
      nw: 315,
    },
    // Special angles for NO_ROTATION dash movements (straight line across grid)
    // Key format: "startLocation,endLocation"
    noRotation: {
      "n,s": 90,
      "e,w": 180,
      "s,n": 270,
      "w,e": 0,
      "se,nw": 225,
      "sw,ne": 315,
      "nw,se": 45,
      "ne,sw": 135,
    },
  },
};

/**
 * Handpath direction pairs for FLOAT arrow rotation calculation.
 * Determines whether hand movement is clockwise, counter-clockwise, or dash (straight).
 */
export const HANDPATH_PAIRS = {
  clockwise: {
    cardinal: [
      ["s", "w"],
      ["w", "n"],
      ["n", "e"],
      ["e", "s"],
    ] as [Location, Location][],
    diagonal: [
      ["ne", "se"],
      ["se", "sw"],
      ["sw", "nw"],
      ["nw", "ne"],
    ] as [Location, Location][],
  },
  counterClockwise: {
    cardinal: [
      ["w", "s"],
      ["n", "w"],
      ["e", "n"],
      ["s", "e"],
    ] as [Location, Location][],
    diagonal: [
      ["ne", "nw"],
      ["nw", "sw"],
      ["sw", "se"],
      ["se", "ne"],
    ] as [Location, Location][],
  },
};

/**
 * Calculate handpath direction from start and end locations.
 *
 * @param startLocation - Start grid location
 * @param endLocation - End grid location
 * @returns "cw" | "ccw" | "static" | "dash"
 */
export function calculateHandpathDirection(
  startLocation: Location,
  endLocation: Location
): "cw" | "ccw" | "static" | "dash" {
  if (startLocation === endLocation) {
    return "static";
  }

  // Check clockwise pairs
  const cwCardinal = HANDPATH_PAIRS.clockwise.cardinal;
  const cwDiagonal = HANDPATH_PAIRS.clockwise.diagonal;
  for (const [start, end] of [...cwCardinal, ...cwDiagonal]) {
    if (startLocation === start && endLocation === end) {
      return "cw";
    }
  }

  // Check counter-clockwise pairs
  const ccwCardinal = HANDPATH_PAIRS.counterClockwise.cardinal;
  const ccwDiagonal = HANDPATH_PAIRS.counterClockwise.diagonal;
  for (const [start, end] of [...ccwCardinal, ...ccwDiagonal]) {
    if (startLocation === start && endLocation === end) {
      return "ccw";
    }
  }

  // Otherwise it's a dash movement (straight line across grid)
  return "dash";
}
