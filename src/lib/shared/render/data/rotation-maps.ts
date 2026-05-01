type Location = "n" | "e" | "s" | "w" | "ne" | "se" | "sw" | "nw";
type LocationMap = Record<Location, number>;
type RotationDirection = "cw" | "ccw";

export interface RotationMaps {
  static: {
    radial: Record<RotationDirection, LocationMap>;
    nonradial: Record<RotationDirection, LocationMap>;
    radialOverride: Record<Location, Record<RotationDirection, number>>;
    nonradialOverride: Record<Location, Record<RotationDirection, number>>;
  };
  pro: Record<RotationDirection, LocationMap>;
  anti: Record<RotationDirection, LocationMap>;
  float: Record<RotationDirection, LocationMap>;
  dash: {
    cw: LocationMap;
    ccw: LocationMap;
    noRotation: Record<string, number>; 
  };
}

export const ROTATION_MAPS: RotationMaps = {
  static: {
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

export function calculateHandpathDirection(
  startLocation: Location,
  endLocation: Location
): "cw" | "ccw" | "static" | "dash" {
  if (startLocation === endLocation) {
    return "static";
  }

  const cwCardinal = HANDPATH_PAIRS.clockwise.cardinal;
  const cwDiagonal = HANDPATH_PAIRS.clockwise.diagonal;
  for (const [start, end] of [...cwCardinal, ...cwDiagonal]) {
    if (startLocation === start && endLocation === end) {
      return "cw";
    }
  }

  const ccwCardinal = HANDPATH_PAIRS.counterClockwise.cardinal;
  const ccwDiagonal = HANDPATH_PAIRS.counterClockwise.diagonal;
  for (const [start, end] of [...ccwCardinal, ...ccwDiagonal]) {
    if (startLocation === start && endLocation === end) {
      return "ccw";
    }
  }

  return "dash";
}
