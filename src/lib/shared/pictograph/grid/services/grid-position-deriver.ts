/**
 * Grid Position Deriver
 *
 * Maps between position names (alpha4, beta2, etc.) and hand location pairs.
 * A position represents the combination of (blue_hand_location, red_hand_location).
 */

import { GridLocation, GridPosition } from "../domain/enums/grid-enums";

const POSITIONS_MAP = new Map<string, GridPosition>([
  // Alpha positions - hands in opposite/inverted directions
  [`${GridLocation.SOUTH},${GridLocation.NORTH}`, GridPosition.ALPHA1],
  [`${GridLocation.SOUTHWEST},${GridLocation.NORTHEAST}`, GridPosition.ALPHA2],
  [`${GridLocation.WEST},${GridLocation.EAST}`, GridPosition.ALPHA3],
  [`${GridLocation.NORTHWEST},${GridLocation.SOUTHEAST}`, GridPosition.ALPHA4],
  [`${GridLocation.NORTH},${GridLocation.SOUTH}`, GridPosition.ALPHA5],
  [`${GridLocation.NORTHEAST},${GridLocation.SOUTHWEST}`, GridPosition.ALPHA6],
  [`${GridLocation.EAST},${GridLocation.WEST}`, GridPosition.ALPHA7],
  [`${GridLocation.SOUTHEAST},${GridLocation.NORTHWEST}`, GridPosition.ALPHA8],

  // Beta positions - both hands same direction
  [`${GridLocation.NORTH},${GridLocation.NORTH}`, GridPosition.BETA1],
  [`${GridLocation.NORTHEAST},${GridLocation.NORTHEAST}`, GridPosition.BETA2],
  [`${GridLocation.EAST},${GridLocation.EAST}`, GridPosition.BETA3],
  [`${GridLocation.SOUTHEAST},${GridLocation.SOUTHEAST}`, GridPosition.BETA4],
  [`${GridLocation.SOUTH},${GridLocation.SOUTH}`, GridPosition.BETA5],
  [`${GridLocation.SOUTHWEST},${GridLocation.SOUTHWEST}`, GridPosition.BETA6],
  [`${GridLocation.WEST},${GridLocation.WEST}`, GridPosition.BETA7],
  [`${GridLocation.NORTHWEST},${GridLocation.NORTHWEST}`, GridPosition.BETA8],

  // Gamma positions - mixed/varied combinations
  [`${GridLocation.WEST},${GridLocation.NORTH}`, GridPosition.GAMMA1],
  [`${GridLocation.NORTHWEST},${GridLocation.NORTHEAST}`, GridPosition.GAMMA2],
  [`${GridLocation.NORTH},${GridLocation.EAST}`, GridPosition.GAMMA3],
  [`${GridLocation.NORTHEAST},${GridLocation.SOUTHEAST}`, GridPosition.GAMMA4],
  [`${GridLocation.EAST},${GridLocation.SOUTH}`, GridPosition.GAMMA5],
  [`${GridLocation.SOUTHEAST},${GridLocation.SOUTHWEST}`, GridPosition.GAMMA6],
  [`${GridLocation.SOUTH},${GridLocation.WEST}`, GridPosition.GAMMA7],
  [`${GridLocation.SOUTHWEST},${GridLocation.NORTHWEST}`, GridPosition.GAMMA8],
  [`${GridLocation.EAST},${GridLocation.NORTH}`, GridPosition.GAMMA9],
  [`${GridLocation.SOUTHEAST},${GridLocation.NORTHEAST}`, GridPosition.GAMMA10],
  [`${GridLocation.SOUTH},${GridLocation.EAST}`, GridPosition.GAMMA11],
  [`${GridLocation.SOUTHWEST},${GridLocation.SOUTHEAST}`, GridPosition.GAMMA12],
  [`${GridLocation.WEST},${GridLocation.SOUTH}`, GridPosition.GAMMA13],
  [`${GridLocation.NORTHWEST},${GridLocation.SOUTHWEST}`, GridPosition.GAMMA14],
  [`${GridLocation.NORTH},${GridLocation.WEST}`, GridPosition.GAMMA15],
  [`${GridLocation.NORTHEAST},${GridLocation.NORTHWEST}`, GridPosition.GAMMA16],

  // Zeta positions - 135° obtuse angle (skewed mode)
  [`${GridLocation.SOUTHWEST},${GridLocation.NORTH}`, GridPosition.ZETA1],
  [`${GridLocation.WEST},${GridLocation.NORTHEAST}`, GridPosition.ZETA2],
  [`${GridLocation.NORTHWEST},${GridLocation.EAST}`, GridPosition.ZETA3],
  [`${GridLocation.NORTH},${GridLocation.SOUTHEAST}`, GridPosition.ZETA4],
  [`${GridLocation.NORTHEAST},${GridLocation.SOUTH}`, GridPosition.ZETA5],
  [`${GridLocation.EAST},${GridLocation.SOUTHWEST}`, GridPosition.ZETA6],
  [`${GridLocation.SOUTHEAST},${GridLocation.WEST}`, GridPosition.ZETA7],
  [`${GridLocation.SOUTH},${GridLocation.NORTHWEST}`, GridPosition.ZETA8],
  [`${GridLocation.SOUTHEAST},${GridLocation.NORTH}`, GridPosition.ZETA9],
  [`${GridLocation.SOUTH},${GridLocation.NORTHEAST}`, GridPosition.ZETA10],
  [`${GridLocation.SOUTHWEST},${GridLocation.EAST}`, GridPosition.ZETA11],
  [`${GridLocation.WEST},${GridLocation.SOUTHEAST}`, GridPosition.ZETA12],
  [`${GridLocation.NORTHWEST},${GridLocation.SOUTH}`, GridPosition.ZETA13],
  [`${GridLocation.NORTH},${GridLocation.SOUTHWEST}`, GridPosition.ZETA14],
  [`${GridLocation.NORTHEAST},${GridLocation.WEST}`, GridPosition.ZETA15],
  [`${GridLocation.EAST},${GridLocation.NORTHWEST}`, GridPosition.ZETA16],

  // Eta positions - 45° acute angle (skewed mode)
  [`${GridLocation.NORTHWEST},${GridLocation.NORTH}`, GridPosition.ETA1],
  [`${GridLocation.NORTH},${GridLocation.NORTHEAST}`, GridPosition.ETA2],
  [`${GridLocation.NORTHEAST},${GridLocation.EAST}`, GridPosition.ETA3],
  [`${GridLocation.EAST},${GridLocation.SOUTHEAST}`, GridPosition.ETA4],
  [`${GridLocation.SOUTHEAST},${GridLocation.SOUTH}`, GridPosition.ETA5],
  [`${GridLocation.SOUTH},${GridLocation.SOUTHWEST}`, GridPosition.ETA6],
  [`${GridLocation.SOUTHWEST},${GridLocation.WEST}`, GridPosition.ETA7],
  [`${GridLocation.WEST},${GridLocation.NORTHWEST}`, GridPosition.ETA8],
  [`${GridLocation.NORTHEAST},${GridLocation.NORTH}`, GridPosition.ETA9],
  [`${GridLocation.EAST},${GridLocation.NORTHEAST}`, GridPosition.ETA10],
  [`${GridLocation.SOUTHEAST},${GridLocation.EAST}`, GridPosition.ETA11],
  [`${GridLocation.SOUTH},${GridLocation.SOUTHEAST}`, GridPosition.ETA12],
  [`${GridLocation.SOUTHWEST},${GridLocation.SOUTH}`, GridPosition.ETA13],
  [`${GridLocation.WEST},${GridLocation.SOUTHWEST}`, GridPosition.ETA14],
  [`${GridLocation.NORTHWEST},${GridLocation.WEST}`, GridPosition.ETA15],
  [`${GridLocation.NORTH},${GridLocation.NORTHWEST}`, GridPosition.ETA16],
]);

// Build reverse mapping from the POSITIONS_MAP
const LOCATION_PAIRS_MAP: Record<GridPosition, [GridLocation, GridLocation]> =
  {} as Record<GridPosition, [GridLocation, GridLocation]>;

POSITIONS_MAP.forEach((position, locationKey) => {
  const [leftLocationStr, rightLocationStr] = locationKey.split(",");
  LOCATION_PAIRS_MAP[position] = [
    leftLocationStr as GridLocation,
    rightLocationStr as GridLocation,
  ];
});

/**
 * Get the hand location pair for a given position
 */
export function getGridLocationsFromPosition(
  position: GridPosition
): [GridLocation, GridLocation] {
  const pair = LOCATION_PAIRS_MAP[position];
  if (!pair) {
    throw new Error(`No location pair found for position: ${position}`);
  }
  return pair;
}

/**
 * Get the position for a given hand location pair
 */
export function getGridPositionFromLocations(
  leftLocation: GridLocation,
  rightLocation: GridLocation
): GridPosition {
  const key = `${leftLocation},${rightLocation}`;
  const position = POSITIONS_MAP.get(key);
  if (!position) {
    throw new Error(
      `No position found for locations: ${leftLocation}, ${rightLocation}`
    );
  }
  return position;
}
