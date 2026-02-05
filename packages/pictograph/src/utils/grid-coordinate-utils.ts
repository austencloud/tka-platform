import { GridMode } from "@tka/types";
import type { GridPointData } from "../domain/grid-models";
import { gridCoordinates } from "../constants/gridCoordinates";

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
  if (mode === GridMode.SKEWED) {
    const diamondData = gridCoordinates[GridMode.DIAMOND];
    const boxData = gridCoordinates[GridMode.BOX];

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

  const modeData = gridCoordinates[mode];

  return {
    allHandPointsStrict: parsePoints(modeData.hand_points.strict),
    allHandPointsNormal: parsePoints(modeData.hand_points.normal),
    allLayer2PointsStrict: parsePoints(modeData.layer2_points.strict),
    allLayer2PointsNormal: parsePoints(modeData.layer2_points.normal),
    allOuterPoints: parsePoints(modeData.outer_points),
    centerPoint: { coordinates: parseCoordinates(modeData.center_point) },
  };
}
