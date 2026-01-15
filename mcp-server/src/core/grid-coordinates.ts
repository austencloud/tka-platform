/**
 * Grid coordinate data for pictograph rendering
 * Ported from src/lib/shared/pictograph/grid for Node.js usage
 *
 * Coordinates are in the 950x950 scene coordinate system with center at (475, 475)
 */

import { GridMode, GridLocation } from "./enums.js";

export interface Coordinates {
  x: number;
  y: number;
}

export interface GridPointEntry {
  coordinates: Coordinates | null;
}

export interface GridPointData {
  allHandPointsStrict: Record<string, GridPointEntry>;
  allHandPointsNormal: Record<string, GridPointEntry>;
  allLayer2PointsStrict: Record<string, GridPointEntry>;
  allLayer2PointsNormal: Record<string, GridPointEntry>;
  allOuterPoints: Record<string, GridPointEntry>;
  centerPoint: GridPointEntry;
}

// Raw coordinate data matching gridCoordinates.ts
const GRID_COORDINATES = {
  diamond: {
    hand_points: {
      normal: {
        n_diamond_hand_point: "(475.0, 331.9)",
        e_diamond_hand_point: "(618.1, 475.0)",
        s_diamond_hand_point: "(475.0, 618.1)",
        w_diamond_hand_point: "(331.9, 475.0)",
      },
      strict: {
        n_diamond_hand_point_strict: "(475.0, 325.0)",
        e_diamond_hand_point_strict: "(625.0, 475.0)",
        s_diamond_hand_point_strict: "(475.0, 625.0)",
        w_diamond_hand_point_strict: "(325.0, 475.0)",
      },
    },
    layer2_points: {
      normal: {
        ne_diamond_layer2_point: "(618.1, 331.9)",
        se_diamond_layer2_point: "(618.1, 618.1)",
        sw_diamond_layer2_point: "(331.9, 618.1)",
        nw_diamond_layer2_point: "(331.9, 331.9)",
      },
      strict: {
        ne_diamond_layer2_point_strict: "(625.0, 325.0)",
        se_diamond_layer2_point_strict: "(625.0, 625.0)",
        sw_diamond_layer2_point_strict: "(325.0, 625.0)",
        nw_diamond_layer2_point_strict: "(325.0, 325.0)",
      },
    },
    outer_points: {
      n_diamond_outer_point: "(475, 175)",
      e_diamond_outer_point: "(775, 475)",
      s_diamond_outer_point: "(475, 775)",
      w_diamond_outer_point: "(175, 475)",
    },
    center_point: "(475.0, 475.0)",
  },
  box: {
    hand_points: {
      normal: {
        ne_box_hand_point: "(576.2, 373.8)",
        se_box_hand_point: "(576.2, 576.2)",
        sw_box_hand_point: "(373.8, 576.2)",
        nw_box_hand_point: "(373.8, 373.8)",
      },
      strict: {
        ne_box_hand_point_strict: "(581.1, 368.9)",
        se_box_hand_point_strict: "(581.1, 581.1)",
        sw_box_hand_point_strict: "(368.9, 581.1)",
        nw_box_hand_point_strict: "(368.9, 368.9)",
      },
    },
    layer2_points: {
      normal: {
        n_box_layer2_point: "(475, 272.6)",
        e_box_layer2_point: "(677.4, 475)",
        s_box_layer2_point: "(475, 677.4)",
        w_box_layer2_point: "(272.6, 475)",
      },
      strict: {
        n_box_layer2_point_strict: "(475, 262.9)",
        e_box_layer2_point_strict: "(687.1, 475)",
        s_box_layer2_point_strict: "(475, 687.1)",
        w_box_layer2_point_strict: "(262.9, 475)",
      },
    },
    outer_points: {
      ne_box_outer_point: "(262.9, 247.9)",
      se_box_outer_point: "(687.1, 247.9)",
      sw_box_outer_point: "(687.1, 672.1)",
      nw_box_outer_point: "(262.9, 672.1)",
    },
    center_point: "(475.0, 475.0)",
  },
};

/**
 * Parse coordinate string "(x, y)" into {x, y} object
 */
export function parseCoordinates(coordString: string): Coordinates | null {
  if (!coordString || coordString === "None") return null;

  try {
    const parts = coordString.replace(/[()]/g, "").split(", ").map(parseFloat);
    if (parts.length !== 2) {
      return null;
    }
    const [x, y] = parts;
    if (x === undefined || y === undefined || isNaN(x) || isNaN(y)) {
      return null;
    }
    return { x, y };
  } catch {
    return null;
  }
}

/**
 * Parse a group of coordinate strings into GridPointEntry records
 */
function parsePoints(points: Record<string, string>): Record<string, GridPointEntry> {
  return Object.fromEntries(
    Object.entries(points).map(([key, value]) => [
      key,
      { coordinates: parseCoordinates(value) },
    ])
  );
}

/**
 * Create structured grid point data for a given grid mode
 */
export function createGridPointData(mode: GridMode): GridPointData {
  // SKEWED mode merges both diamond and box coordinates
  if (mode === GridMode.SKEWED) {
    const diamondData = GRID_COORDINATES.diamond;
    const boxData = GRID_COORDINATES.box;

    return {
      allHandPointsStrict: {
        ...parsePoints(diamondData.hand_points.strict),
        ...parsePoints(boxData.hand_points.strict),
      },
      allHandPointsNormal: {
        ...parsePoints(diamondData.hand_points.normal),
        ...parsePoints(boxData.hand_points.normal),
      },
      allLayer2PointsStrict: {
        ...parsePoints(diamondData.layer2_points.strict),
        ...parsePoints(boxData.layer2_points.strict),
      },
      allLayer2PointsNormal: {
        ...parsePoints(diamondData.layer2_points.normal),
        ...parsePoints(boxData.layer2_points.normal),
      },
      allOuterPoints: {
        ...parsePoints(diamondData.outer_points),
        ...parsePoints(boxData.outer_points),
      },
      centerPoint: { coordinates: parseCoordinates(diamondData.center_point) },
    };
  }

  const modeKey = mode === GridMode.DIAMOND ? "diamond" : "box";
  const modeData = GRID_COORDINATES[modeKey];

  return {
    allHandPointsStrict: parsePoints(modeData.hand_points.strict),
    allHandPointsNormal: parsePoints(modeData.hand_points.normal),
    allLayer2PointsStrict: parsePoints(modeData.layer2_points.strict),
    allLayer2PointsNormal: parsePoints(modeData.layer2_points.normal),
    allOuterPoints: parsePoints(modeData.outer_points),
    centerPoint: { coordinates: parseCoordinates(modeData.center_point) },
  };
}

/**
 * Get hand point coordinates for a location and grid mode
 * This is the core function for prop positioning
 */
export function getHandPointCoordinates(
  location: GridLocation | string,
  gridMode: GridMode
): Coordinates {
  const normalizedLocation = (typeof location === "string" ? location : location).toLowerCase();

  // For SKEWED mode, determine grid type based on location
  let gridType: string;
  if (gridMode === GridMode.SKEWED) {
    const cardinalLocs = new Set(["n", "e", "s", "w"]);
    gridType = cardinalLocs.has(normalizedLocation) ? "diamond" : "box";
  } else {
    gridType = gridMode;
  }

  const gridData = createGridPointData(gridMode);
  const pointName = `${normalizedLocation}_${gridType}_hand_point`;

  const point = gridData.allHandPointsNormal[pointName];
  if (point?.coordinates) {
    return point.coordinates;
  }

  // Fallback coordinates matching actual grid data
  const fallbacks: Record<string, Coordinates> = {
    n: { x: 475, y: 331.9 },
    e: { x: 618.1, y: 475 },
    s: { x: 475, y: 618.1 },
    w: { x: 331.9, y: 475 },
    ne: { x: 576.2, y: 373.8 },
    se: { x: 576.2, y: 576.2 },
    sw: { x: 373.8, y: 576.2 },
    nw: { x: 373.8, y: 373.8 },
  };

  return fallbacks[normalizedLocation] || { x: 475, y: 475 };
}

/**
 * Get layer2 point coordinates for a location
 * Used for arrow positioning
 */
export function getLayer2PointCoordinates(
  location: GridLocation | string,
  gridMode: GridMode
): Coordinates {
  const normalizedLocation = (typeof location === "string" ? location : location).toLowerCase();

  let gridType: string;
  if (gridMode === GridMode.SKEWED) {
    const cardinalLocs = new Set(["n", "e", "s", "w"]);
    gridType = cardinalLocs.has(normalizedLocation) ? "diamond" : "box";
  } else {
    gridType = gridMode;
  }

  const gridData = createGridPointData(gridMode);
  const pointName = `${normalizedLocation}_${gridType}_layer2_point`;

  const point = gridData.allLayer2PointsNormal[pointName];
  if (point?.coordinates) {
    return point.coordinates;
  }

  // Fallback to hand point if layer2 not found
  return getHandPointCoordinates(location, gridMode);
}

/**
 * Get outer point coordinates for a location
 * Used for grid rendering
 */
export function getOuterPointCoordinates(
  location: GridLocation | string,
  gridMode: GridMode
): Coordinates {
  const normalizedLocation = (typeof location === "string" ? location : location).toLowerCase();

  const gridType = gridMode === GridMode.BOX ? "box" : "diamond";
  const gridData = createGridPointData(gridMode);
  const pointName = `${normalizedLocation}_${gridType}_outer_point`;

  const point = gridData.allOuterPoints[pointName];
  if (point?.coordinates) {
    return point.coordinates;
  }

  // Fallback outer coordinates
  const fallbacks: Record<string, Coordinates> = {
    n: { x: 475, y: 175 },
    e: { x: 775, y: 475 },
    s: { x: 475, y: 775 },
    w: { x: 175, y: 475 },
  };

  return fallbacks[normalizedLocation] || { x: 475, y: 475 };
}
