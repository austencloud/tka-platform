import {
  GridLocation,
  GridMode,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { createGridPointData } from "$lib/shared/pictograph/grid/utils/grid-coordinate-utils";

export interface PlacementGridPoint {
  location: GridLocation;
  label: string;
  x: number;
  y: number;
}

const DIAMOND_LOCATIONS = [
  GridLocation.NORTH,
  GridLocation.EAST,
  GridLocation.SOUTH,
  GridLocation.WEST,
] as const;

const BOX_LOCATIONS = [
  GridLocation.NORTHEAST,
  GridLocation.SOUTHEAST,
  GridLocation.SOUTHWEST,
  GridLocation.NORTHWEST,
] as const;

const LOCATION_LABELS: Record<GridLocation, string> = {
  [GridLocation.NORTH]: "North",
  [GridLocation.NORTHEAST]: "Northeast",
  [GridLocation.EAST]: "East",
  [GridLocation.SOUTHEAST]: "Southeast",
  [GridLocation.SOUTH]: "South",
  [GridLocation.SOUTHWEST]: "Southwest",
  [GridLocation.WEST]: "West",
  [GridLocation.NORTHWEST]: "Northwest",
  [GridLocation.CENTER]: "Center",
};

/**
 * Return the canonical hand points used by the pictograph renderer. Construct
 * and Learn share this adapter so their hit targets cannot drift apart.
 */
export function getPlacementGridPoints(
  gridMode: GridMode
): PlacementGridPoint[] {
  if (gridMode !== GridMode.DIAMOND && gridMode !== GridMode.BOX) {
    throw new Error(`Placement is unavailable for grid mode: ${gridMode}`);
  }

  const pointData = createGridPointData(gridMode).allHandPointsNormal;
  const locations =
    gridMode === GridMode.DIAMOND ? DIAMOND_LOCATIONS : BOX_LOCATIONS;

  return locations.map((location) => {
    const key = Object.keys(pointData).find((candidate) =>
      candidate.startsWith(`${location}_`)
    );
    const coordinates = key ? pointData[key]?.coordinates : null;

    if (!coordinates) {
      throw new Error(
        `Missing canonical ${gridMode} placement point for ${location}`
      );
    }

    return {
      location,
      label: LOCATION_LABELS[location],
      x: coordinates.x,
      y: coordinates.y,
    };
  });
}
