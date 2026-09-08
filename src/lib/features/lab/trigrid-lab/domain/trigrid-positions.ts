/**
 * Trigrid Position Definitions
 *
 * On the trigrid, only two position groups exist:
 * - Beta: both hands at the same vertex (3 variations)
 * - Gamma: hands at different vertices, 120 degrees apart (3 variations)
 *
 * Alpha positions don't exist because there are no opposite points on a 3-point grid.
 */

import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { TriGridMode, TriGridPositionInfo } from "./trigrid-types";
import { getTriGridLocations } from "./trigrid-coordinates";

/** Location label abbreviations */
const LOCATION_LABELS: Record<string, string> = {
  [GridLocation.NORTH]: "N",
  [GridLocation.SOUTH]: "S",
  [GridLocation.NORTHEAST]: "NE",
  [GridLocation.NORTHWEST]: "NW",
  [GridLocation.SOUTHEAST]: "SE",
  [GridLocation.SOUTHWEST]: "SW",
};

function locationLabel(loc: GridLocation): string {
  return LOCATION_LABELS[loc] ?? loc;
}

/**
 * Get all trigrid positions for a given mode.
 * Returns 3 beta + 3 gamma = 6 total positions.
 */
export function getTriGridPositions(mode: TriGridMode): TriGridPositionInfo[] {
  const locs = getTriGridLocations(mode);
  const positions: TriGridPositionInfo[] = [];

  // 3 beta positions: both hands at same vertex
  for (let i = 0; i < locs.length; i++) {
    const loc = locs[i]!;
    positions.push({
      group: "beta",
      index: i + 1,
      label: `Beta ${i + 1} (${locationLabel(loc)})`,
      leftLocation: loc,
      rightLocation: loc,
    });
  }

  // 3 gamma positions: hands at different vertices
  // Each pairing of two distinct vertices from the three available
  let gammaIndex = 1;
  for (let i = 0; i < locs.length; i++) {
    for (let j = i + 1; j < locs.length; j++) {
      const left = locs[i]!;
      const right = locs[j]!;
      positions.push({
        group: "gamma",
        index: gammaIndex,
        label: `Gamma ${gammaIndex} (${locationLabel(left)}, ${locationLabel(right)})`,
        leftLocation: left,
        rightLocation: right,
      });
      gammaIndex++;
    }
  }

  return positions;
}

/**
 * Resolve position group from blue and red grid locations.
 */
export function resolveTriGridPosition(
  leftLocation: GridLocation,
  rightLocation: GridLocation,
  mode: TriGridMode,
): TriGridPositionInfo | null {
  const positions = getTriGridPositions(mode);
  return (
    positions.find(
      (p) =>
        (p.leftLocation === leftLocation && p.rightLocation === rightLocation) ||
        (p.leftLocation === rightLocation && p.rightLocation === leftLocation),
    ) ?? null
  );
}
