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
export function deriveGridMode(blueMotion: MotionData, redMotion: MotionData): GridMode {
  const blueIsDiamond = usesDiamondLocations(blueMotion);
  const redIsDiamond = usesDiamondLocations(redMotion);

  const blueIsBox = usesBoxLocations(blueMotion);
  const redIsBox = usesBoxLocations(redMotion);

  const blueIsSkewed = isSkewed(blueMotion);
  const redIsSkewed = isSkewed(redMotion);

  if (blueIsSkewed || redIsSkewed) {
    return GridMode.SKEWED;
  }

  if ((blueIsDiamond && redIsBox) || (blueIsBox && redIsDiamond)) {
    return GridMode.SKEWED;
  }

  if (blueIsDiamond && redIsDiamond) {
    return GridMode.DIAMOND;
  } else if (blueIsBox && redIsBox) {
    return GridMode.BOX;
  } else {
    console.warn(
      "deriveGridMode: Unable to determine grid mode from motions. Defaulting to DIAMOND."
    );
    return GridMode.DIAMOND;
  }
}

export function computeGridData(blueMotion: MotionData, redMotion: MotionData): GridData {
  const gridMode = deriveGridMode(blueMotion, redMotion);
  const gridData: GridData = { gridMode } as GridData;
  return gridData;
}
