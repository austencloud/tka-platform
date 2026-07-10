/**
 * Arrow Quadrant Calculator
 *
 * Handles quadrant index calculations for different grid modes and motion types.
 * Implements sophisticated quadrant mapping logic from desktop implementations.
 */

import {
  GridLocation,
  GridMode,
} from "../../../grid/domain/enums/grid-enums";
import { MotionType } from "../../../shared/domain/enums/pictograph-enums";
import type { MotionData } from "../../../shared/domain/models/motion-data";

export function calculateQuadrantIndex(
  motion: Pick<MotionData, "motionType" | "startLocation" | "endLocation">,
  location: GridLocation
): number {
  const gridMode = determineGridMode(motion, location);
  const motionType = motion.motionType;

  if (gridMode === GridMode.DIAMOND) {
    if (isShiftMotion(motionType)) {
      return diamondShiftQuadrantIndex(location);
    } else {
      return diamondStaticDashQuadrantIndex(location);
    }
  } else {
    if (isShiftMotion(motionType)) {
      return boxShiftQuadrantIndex(location);
    } else {
      return boxStaticDashQuadrantIndex(location);
    }
  }
}

export function determineGridMode(
  motion: Pick<MotionData, "motionType" | "startLocation" | "endLocation">,
  calculatedLocation?: GridLocation
): GridMode {
  const diagonalLocations: GridLocation[] = [
    GridLocation.NORTHEAST,
    GridLocation.SOUTHEAST,
    GridLocation.SOUTHWEST,
    GridLocation.NORTHWEST,
  ];

  const cardinalLocations: GridLocation[] = [
    GridLocation.NORTH,
    GridLocation.EAST,
    GridLocation.SOUTH,
    GridLocation.WEST,
  ];

  if (calculatedLocation && isShiftMotion(motion.motionType)) {
    const locationIsDiagonal = diagonalLocations.includes(calculatedLocation);
    if (locationIsDiagonal) {
      return GridMode.DIAMOND;
    } else {
      return GridMode.BOX;
    }
  }

  const startIsCardinal = cardinalLocations.includes(motion.startLocation);
  const endIsCardinal = cardinalLocations.includes(motion.endLocation);

  if (startIsCardinal || endIsCardinal) {
    return GridMode.DIAMOND;
  }

  return GridMode.BOX;
}

export function isShiftMotion(motionType: MotionType): boolean {
  const shiftTypes: MotionType[] = [
    MotionType.PRO,
    MotionType.ANTI,
    MotionType.FLOAT,
  ];
  return shiftTypes.includes(motionType);
}

export function diamondShiftQuadrantIndex(location: GridLocation): number {
  const locationToIndex: Partial<Record<GridLocation, number>> = {
    [GridLocation.NORTHEAST]: 0,
    [GridLocation.SOUTHEAST]: 1,
    [GridLocation.SOUTHWEST]: 2,
    [GridLocation.NORTHWEST]: 3,
  };
  return locationToIndex[location] || 0;
}

export function diamondStaticDashQuadrantIndex(location: GridLocation): number {
  const locationToIndex: Partial<Record<GridLocation, number>> = {
    [GridLocation.NORTH]: 0,
    [GridLocation.EAST]: 1,
    [GridLocation.SOUTH]: 2,
    [GridLocation.WEST]: 3,
  };
  return locationToIndex[location] || 0;
}

export function boxShiftQuadrantIndex(location: GridLocation): number {
  const locationToIndex: Partial<Record<GridLocation, number>> = {
    [GridLocation.NORTH]: 0,
    [GridLocation.EAST]: 1,
    [GridLocation.SOUTH]: 2,
    [GridLocation.WEST]: 3,
  };
  return locationToIndex[location] || 0;
}

export function boxStaticDashQuadrantIndex(location: GridLocation): number {
  const locationToIndex: Partial<Record<GridLocation, number>> = {
    [GridLocation.NORTHEAST]: 0,
    [GridLocation.SOUTHEAST]: 1,
    [GridLocation.SOUTHWEST]: 2,
    [GridLocation.NORTHWEST]: 3,
  };
  return locationToIndex[location] || 0;
}

export function getQuadrantMapping(
  _gridMode: GridMode,
  motionType: MotionType
): Record<GridLocation, number> {
  const mapping: Partial<Record<GridLocation, number>> = {};

  const locations = [
    GridLocation.NORTHEAST,
    GridLocation.SOUTHEAST,
    GridLocation.SOUTHWEST,
    GridLocation.NORTHWEST,
  ];

  for (const location of locations) {
    // Only motionType is read by calculateQuadrantIndex/determineGridMode in
    // this mapping-table context (locations are pre-set diagonal quadrants,
    // so startLocation/endLocation are irrelevant to the shift-vs-static
    // branch here) — start/end are set to the loop location as harmless
    // stand-ins rather than lying about a full MotionData.
    const motion = { motionType, startLocation: location, endLocation: location };
    mapping[location] = calculateQuadrantIndex(motion, location);
  }

  return mapping as Record<GridLocation, number>;
}
