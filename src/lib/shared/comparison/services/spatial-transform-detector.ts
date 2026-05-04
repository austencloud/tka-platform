/**
 * Spatial Transform Detector
 *
 * Detects what spatial transform (if any) relates two beats or sequences.
 * A spatial transform is a rotation around the grid center (0-7 steps of 45°).
 */

import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import type { SpatialTransform, SpatialTransformResult } from "../domain/models/signatures";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { LOCATION_MAP_EIGHTH_CW } from "$lib/features/create/generate/circular/domain/constants/circular-position-maps";

/**
 * All 8 possible spatial transforms (0° to 315° in 45° increments)
 */
const ALL_TRANSFORMS: readonly SpatialTransform[] = Array.from({ length: 8 }, (_, i) => ({
  rotationSteps: i,
  gridModeToggled: i % 2 === 1,
}));

export function rotateLocation(location: GridLocation, steps: number): GridLocation {
  const normalizedSteps = ((steps % 8) + 8) % 8;
  if (normalizedSteps === 0) return location;

  let rotated = location;
  for (let i = 0; i < normalizedSteps; i++) {
    rotated = LOCATION_MAP_EIGHTH_CW[rotated] ?? rotated;
  }
  return rotated;
}

export function isRotationOf(beatA: StepData, beatB: StepData, rotationSteps: number): boolean {
  const blueA = beatA.motions[MotionColor.BLUE];
  const redA = beatA.motions[MotionColor.RED];
  const blueB = beatB.motions[MotionColor.BLUE];
  const redB = beatB.motions[MotionColor.RED];

  if (!blueA || !redA || !blueB || !redB) return false;

  const rotatedBlueStart = rotateLocation(blueA.startLocation, rotationSteps);
  const rotatedBlueEnd = rotateLocation(blueA.endLocation, rotationSteps);
  const rotatedRedStart = rotateLocation(redA.startLocation, rotationSteps);
  const rotatedRedEnd = rotateLocation(redA.endLocation, rotationSteps);

  const locationsMatch =
    rotatedBlueStart === blueB.startLocation &&
    rotatedBlueEnd === blueB.endLocation &&
    rotatedRedStart === redB.startLocation &&
    rotatedRedEnd === redB.endLocation;

  if (!locationsMatch) return false;

  const motionTypesMatch =
    blueA.motionType === blueB.motionType &&
    redA.motionType === redB.motionType;

  if (!motionTypesMatch) return false;

  const rotationDirectionsMatch =
    blueA.rotationDirection === blueB.rotationDirection &&
    redA.rotationDirection === redB.rotationDirection;

  if (!rotationDirectionsMatch) return false;

  const turnsMatch = blueA.turns === blueB.turns && redA.turns === redB.turns;
  if (!turnsMatch) return false;

  return (
    blueA.startOrientation === blueB.startOrientation &&
    blueA.endOrientation === blueB.endOrientation &&
    redA.startOrientation === redB.startOrientation &&
    redA.endOrientation === redB.endOrientation
  );
}

export function findSpatialTransform(beatA: StepData, beatB: StepData): SpatialTransformResult {
  for (const transform of ALL_TRANSFORMS) {
    if (isRotationOf(beatA, beatB, transform.rotationSteps)) {
      return { found: true, transform };
    }
  }
  return { found: false, transform: null };
}

export function getAllSpatialTransforms(): readonly SpatialTransform[] {
  return ALL_TRANSFORMS;
}

export function getAngularDistance(from: GridLocation, to: GridLocation): number {
  const LOCATION_TO_ANGLE: Record<GridLocation, number> = {
    [GridLocation.NORTH]: 0,
    [GridLocation.NORTHEAST]: 1,
    [GridLocation.EAST]: 2,
    [GridLocation.SOUTHEAST]: 3,
    [GridLocation.SOUTH]: 4,
    [GridLocation.SOUTHWEST]: 5,
    [GridLocation.WEST]: 6,
    [GridLocation.NORTHWEST]: 7,
    [GridLocation.CENTER]: 0,
  };
  const fromAngle = LOCATION_TO_ANGLE[from];
  const toAngle = LOCATION_TO_ANGLE[to];
  const cwDistance = (toAngle - fromAngle + 8) % 8;
  return Math.min(cwDistance, 8 - cwDistance);
}
