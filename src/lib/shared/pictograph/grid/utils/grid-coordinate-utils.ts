/**
 * Grid coordinate data for pictograph rendering
 * This data defines the precise positioning points for arrows and props
 * in both diamond and box grid modes.
 *
 * Coordinates are in the 950x950 scene coordinate system with center at (475, 475)
 */

import { GridMode } from "../domain/enums/grid-enums";
import type { GridPointData } from "../domain/models/grid-models";
import { gridCoordinates } from "../domain/constants/grid-coordinates";

/**
 * Parse coordinate string "(x, y)" into {x, y} object
 */
export function parseCoordinates(
  coordString: string
): { x: number; y: number } | null {
  if (!coordString || coordString === "None") return null;

  try {
    const parts = coordString.replace(/[()]/g, "").split(", ").map(parseFloat);
    if (parts.length !== 2) {
      console.error(`Invalid coordinate format: "${coordString}"`);
      return null;
    }
    const [x, y] = parts;
    if (x === undefined || y === undefined || isNaN(x) || isNaN(y)) {
      console.error(`Invalid coordinates parsed: "${coordString}"`);
      return null;
    }
    return { x, y };
  } catch (error) {
    console.error(`Failed to parse coordinates: "${coordString}"`, error);
    return null;
  }
}

/**
 * Convert raw coordinate data into structured GridPointData format
 */
export function createGridPointData(mode: GridMode): GridPointData {
  const parsePoints = (points: Record<string, string>) =>
    Object.fromEntries(
      Object.entries(points).map(([key, value]) => [
        key,
        { coordinates: parseCoordinates(value) },
      ])
    );

  // SKEWED mode merges both diamond and box coordinates
  // This is needed because skewed positions have one hand in cardinal (diamond)
  // and one hand in intercardinal (box) positions
  if (mode === GridMode.SKEWED) {
    const diamondData = gridCoordinates[GridMode.DIAMOND];
    const boxData = gridCoordinates[GridMode.BOX];

    return {
      // Merge hand points from both diamond (n,e,s,w) and box (ne,se,sw,nw)
      allHandPointsStrict: {
        ...parsePoints(diamondData.hand_points.strict),
        ...parsePoints(boxData.hand_points.strict),
      },
      allHandPointsNormal: {
        ...parsePoints(diamondData.hand_points.normal),
        ...parsePoints(boxData.hand_points.normal),
      },
      // Merge layer2 points from both
      allLayer2PointsStrict: {
        ...parsePoints(diamondData.layer2_points.strict),
        ...parsePoints(boxData.layer2_points.strict),
      },
      allLayer2PointsNormal: {
        ...parsePoints(diamondData.layer2_points.normal),
        ...parsePoints(boxData.layer2_points.normal),
      },
      // Merge outer points from both diamond (cardinal) and box (intercardinal)
      allOuterPoints: {
        ...parsePoints(diamondData.outer_points),
        ...parsePoints(boxData.outer_points),
      },
      centerPoint: { coordinates: parseCoordinates(diamondData.center_point) },
    };
  }

  if (!(mode in gridCoordinates)) {
    throw new Error(`Grid coordinates not available for mode: ${mode}`);
  }

  const modeData =
    gridCoordinates[mode as Exclude<GridMode, "skewed" | "trigrid" | "8point">];

  return {
    allHandPointsStrict: parsePoints(modeData.hand_points.strict),
    allHandPointsNormal: parsePoints(modeData.hand_points.normal),
    allLayer2PointsStrict: parsePoints(modeData.layer2_points.strict),
    allLayer2PointsNormal: parsePoints(modeData.layer2_points.normal),
    allOuterPoints: parsePoints(modeData.outer_points),
    centerPoint: { coordinates: parseCoordinates(modeData.center_point) },
  };
}
