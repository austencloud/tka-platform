type Location = "n" | "e" | "s" | "w" | "ne" | "se" | "sw" | "nw";
type Coordinate = [number, number]; 

export interface GridModeCoordinates {
  hand: Record<Location, Coordinate>;
  layer2: Record<Location, Coordinate>;
  outer?: Record<Location, Coordinate>;
}

export interface GridCoordinateSystem {
  diamond: GridModeCoordinates;
  box: GridModeCoordinates;
  center: Coordinate;
  viewBox: number;
}

export const GRID_COORDINATES: GridCoordinateSystem = {
  diamond: {
    hand: {
      n: [475.0, 331.9],
      e: [618.1, 475.0],
      s: [475.0, 618.1],
      w: [331.9, 475.0],
      ne: [618.1, 331.9],
      se: [618.1, 618.1],
      sw: [331.9, 618.1],
      nw: [331.9, 331.9],
    },
    layer2: {
      n: [475.0, 331.9],
      e: [618.1, 475.0],
      s: [475.0, 618.1],
      w: [331.9, 475.0],
      ne: [618.1, 331.9],
      se: [618.1, 618.1],
      sw: [331.9, 618.1],
      nw: [331.9, 331.9],
    },
    outer: {
      n: [475, 175],
      e: [775, 475],
      s: [475, 775],
      w: [175, 475],
      ne: [775, 175],
      se: [775, 775],
      sw: [175, 775],
      nw: [175, 175],
    },
  },

  box: {
    hand: {
      n: [475.0, 272.6],
      e: [677.4, 475.0],
      s: [475.0, 677.4],
      w: [272.6, 475.0],
      ne: [576.2, 373.8],
      se: [576.2, 576.2],
      sw: [373.8, 576.2],
      nw: [373.8, 373.8],
    },
    layer2: {
      n: [475.0, 272.6],
      e: [677.4, 475.0],
      s: [475.0, 677.4],
      w: [272.6, 475.0],
      ne: [576.2, 373.8],
      se: [576.2, 576.2],
      sw: [373.8, 576.2],
      nw: [373.8, 373.8],
    },
    outer: {
      n: [475, 175],
      e: [775, 475],
      s: [475, 775],
      w: [175, 475],
      ne: [687.1, 247.9],
      se: [687.1, 672.1],
      sw: [262.9, 672.1],
      nw: [262.9, 247.9],
    },
  },

  center: [475.0, 475.0],
  viewBox: 950,
};

export const SHIFT_DIRECTION_PAIRS: Record<string, Location> = {
  "e|n": "ne", 
  "e|s": "se", 
  "s|w": "sw", 
  "n|w": "nw", 

  "ne|se": "e", 
  "se|sw": "s", 
  "nw|sw": "w", 
  "ne|nw": "n", 
};

export function createPairKey(first: Location, second: Location): string {
  if (first === second) {
    return `${first}|${second}`;
  }
  return first < second ? `${first}|${second}` : `${second}|${first}`;
}

export function getShiftLocation(
  startLocation: Location,
  endLocation: Location
): Location {
  const key = createPairKey(startLocation, endLocation);
  return SHIFT_DIRECTION_PAIRS[key] || startLocation;
}

export const OPPOSITE_LOCATIONS: Record<Location, Location> = {
  n: "s",
  s: "n",
  e: "w",
  w: "e",
  ne: "sw",
  sw: "ne",
  se: "nw",
  nw: "se",
};

export function isCardinalLocation(location: Location): boolean {
  return ["n", "e", "s", "w"].includes(location);
}

export function isDiagonalLocation(location: Location): boolean {
  return ["ne", "se", "sw", "nw"].includes(location);
}
