/**
 * Grid Mode Deriver
 *
 * Determines grid mode from motion data.
 *
 * CORRECTED LOGIC:
 * - Cardinal locations (N, E, S, W) in start/end positions = DIAMOND mode
 * - Box locations (NE, SE, SW, NW) in start/end positions = BOX mode
 */

import { GridLocation, GridMode } from "../domain/enums/grid-enums";
import type { GridData } from "../domain/models/grid-models";
import type { MotionData } from "../../shared/domain/models/motion-data";

const cardinalLocations: GridLocation[] = [
  GridLocation.NORTH,
  GridLocation.EAST,
  GridLocation.SOUTH,
  GridLocation.WEST,
];

const intercardinalLocations: GridLocation[] = [
  GridLocation.NORTHEAST,
  GridLocation.SOUTHEAST,
  GridLocation.SOUTHWEST,
  GridLocation.NORTHWEST,
];

export function usesDiamondLocations(motion: MotionData): boolean {
  return (
    cardinalLocations.includes(motion.startLocation) &&
    cardinalLocations.includes(motion.endLocation)
  );
}

export function usesBoxLocations(motion: MotionData): boolean {
  return (
    intercardinalLocations.includes(motion.startLocation) &&
    intercardinalLocations.includes(motion.endLocation)
  );
}

export function isSkewed(motion: MotionData): boolean {
  const startIsCardinal = cardinalLocations.includes(motion.startLocation);
  const endIsCardinal = cardinalLocations.includes(motion.endLocation);
  const startIsBox = intercardinalLocations.includes(motion.startLocation);
  const endIsBox = intercardinalLocations.includes(motion.endLocation);

  return (startIsCardinal && endIsBox) || (startIsBox && endIsCardinal);
}

/**
 * Determine grid mode from motion start/end locations.
 * CORRECTED: Cardinal locations = Diamond mode.
 */
export function deriveGridMode(leftMotion: MotionData, rightMotion: MotionData): GridMode {
  const leftIsDiamond = usesDiamondLocations(leftMotion);
  const rightIsDiamond = usesDiamondLocations(rightMotion);

  const leftIsBox = usesBoxLocations(leftMotion);
  const rightIsBox = usesBoxLocations(rightMotion);

  const leftIsSkewed = isSkewed(leftMotion);
  const rightIsSkewed = isSkewed(rightMotion);

  if (leftIsSkewed || rightIsSkewed) {
    return GridMode.SKEWED;
  }

  if ((leftIsDiamond && rightIsBox) || (leftIsBox && rightIsDiamond)) {
    return GridMode.SKEWED;
  }

  if (leftIsDiamond && rightIsDiamond) {
    return GridMode.DIAMOND;
  } else if (leftIsBox && rightIsBox) {
    return GridMode.BOX;
  } else {
    console.warn(
      "deriveGridMode: Unable to determine grid mode from motions. Defaulting to DIAMOND."
    );
    return GridMode.DIAMOND;
  }
}

export function computeGridData(leftMotion: MotionData, rightMotion: MotionData): GridData {
  const gridMode = deriveGridMode(leftMotion, rightMotion);
  const gridData: GridData = { gridMode } as GridData;
  return gridData;
}
