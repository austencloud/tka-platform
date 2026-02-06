/**
 * Grid Coordinates for Canvas 2D Direct Renderer
 *
 * Ported from the SVG rendering system's grid coordinate constants.
 * All coordinates are in the 950x950 viewBox coordinate system.
 */

type Location = "n" | "e" | "s" | "w" | "ne" | "se" | "sw" | "nw";
type Coordinate = [number, number]; // [x, y]

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

/**
 * Complete grid coordinate system for both diamond and box modes.
 *
 * The coordinate system uses a 950x950 viewBox with center at (475, 475).
 *
 * Diamond Mode:
 *   - Hand points are at cardinal positions (N, E, S, W)
 *   - Layer2 (shift arrow) points are at diagonal positions (NE, SE, SW, NW)
 *
 * Box Mode:
 *   - Hand points are at diagonal positions (NE, SE, SW, NW)
 *   - Layer2 (shift arrow) points are at cardinal positions (N, E, S, W)
 */
export const GRID_COORDINATES: GridCoordinateSystem = {
  // ============================================================
  // DIAMOND MODE
  // Hand points at cardinal positions, Layer2 at diagonals
  // ============================================================
  diamond: {
    hand: {
      n: [475.0, 331.9],
      e: [618.1, 475.0],
      s: [475.0, 618.1],
      w: [331.9, 475.0],
      // Diagonals not used for hand points in diamond mode,
      // but included for completeness
      ne: [618.1, 331.9],
      se: [618.1, 618.1],
      sw: [331.9, 618.1],
      nw: [331.9, 331.9],
    },
    layer2: {
      // Cardinals not used for layer2 in diamond mode
      n: [475.0, 331.9],
      e: [618.1, 475.0],
      s: [475.0, 618.1],
      w: [331.9, 475.0],
      // Diagonals are the actual layer2 points
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

  // ============================================================
  // BOX MODE
  // Hand points at diagonal positions, Layer2 at cardinals
  // ============================================================
  box: {
    hand: {
      // Cardinals not used for hand points in box mode
      n: [475.0, 272.6],
      e: [677.4, 475.0],
      s: [475.0, 677.4],
      w: [272.6, 475.0],
      // Diagonals are the actual hand points
      ne: [576.2, 373.8],
      se: [576.2, 576.2],
      sw: [373.8, 576.2],
      nw: [373.8, 373.8],
    },
    layer2: {
      // Cardinals are the actual layer2 points
      n: [475.0, 272.6],
      e: [677.4, 475.0],
      s: [475.0, 677.4],
      w: [272.6, 475.0],
      // Diagonals not used for layer2 in box mode
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

/**
 * Direction pair mappings for shift arrow locations.
 *
 * When a motion goes from startLocation to endLocation, the arrow is placed
 * at the location between them. This creates a stable lookup using sorted keys.
 *
 * Diamond mode: Cardinal → Cardinal = Diagonal arrow position
 *   N,E → NE, E,S → SE, S,W → SW, W,N → NW
 *
 * Box mode: Diagonal → Diagonal = Cardinal arrow position
 *   NE,SE → E, SE,SW → S, SW,NW → W, NW,NE → N
 *
 * Key format: sorted pair joined with "|" (e.g., "e|n" for N,E or E,N)
 */
export const SHIFT_DIRECTION_PAIRS: Record<string, Location> = {
  // Diamond mode: Cardinal to Cardinal → Diagonal
  "e|n": "ne", // N,E or E,N → NE
  "e|s": "se", // E,S or S,E → SE
  "s|w": "sw", // S,W or W,S → SW
  "n|w": "nw", // W,N or N,W → NW

  // Box mode: Diagonal to Diagonal → Cardinal
  "ne|se": "e", // NE,SE or SE,NE → E
  "se|sw": "s", // SE,SW or SW,SE → S
  "nw|sw": "w", // SW,NW or NW,SW → W
  "ne|nw": "n", // NW,NE or NE,NW → N
};

/**
 * Create a stable lookup key for unordered location pairs.
 * Ensures (a,b) and (b,a) resolve to the same lookup string.
 *
 * @param first - First grid location
 * @param second - Second grid location
 * @returns Sorted key in format "loc1|loc2"
 */
export function createPairKey(first: Location, second: Location): string {
  if (first === second) {
    return `${first}|${second}`;
  }
  return first < second ? `${first}|${second}` : `${second}|${first}`;
}

/**
 * Get the shift arrow location for a pro/anti/float motion.
 *
 * @param startLocation - Motion start location
 * @param endLocation - Motion end location
 * @returns The grid location where the shift arrow should be placed
 */
export function getShiftLocation(
  startLocation: Location,
  endLocation: Location
): Location {
  const key = createPairKey(startLocation, endLocation);
  return SHIFT_DIRECTION_PAIRS[key] || startLocation;
}

/**
 * Get the opposite location (180° across the grid).
 */
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

/**
 * Check if a location is cardinal (N, E, S, W).
 */
export function isCardinalLocation(location: Location): boolean {
  return ["n", "e", "s", "w"].includes(location);
}

/**
 * Check if a location is diagonal (NE, SE, SW, NW).
 */
export function isDiagonalLocation(location: Location): boolean {
  return ["ne", "se", "sw", "nw"].includes(location);
}
