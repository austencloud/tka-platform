/**
 * Converts 2D plane coordinates to 3D world space.
 */

import type { Vector3, Quaternion } from "three";
import type { Plane } from "@austencloud/scene-3d";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  GRID_RADIUS_3D,
  planeAngleToWorldPosition,
  getPlaneNormal,
  calculatePropQuaternion,
} from "../domain/constants/plane-transforms";
import { LOCATION_ANGLES } from "$lib/shared/foundation/domain/math-constants";

/** Convert a path angle on a plane to a 3D world position. */
export function angleToPosition3D(plane: Plane, angle: number, radius: number = GRID_RADIUS_3D): Vector3 {
  return planeAngleToWorldPosition(plane, angle, radius);
}

/** Convert a GridLocation on a plane to a 3D world position. */
export function gridLocationToPosition3D(
  plane: Plane,
  location: GridLocation,
  radius: number = GRID_RADIUS_3D,
): Vector3 {
  const angle = LOCATION_ANGLES[location];
  if (angle === undefined) {
    console.warn(`Unknown GridLocation: ${location}, defaulting to EAST (0)`);
    return angleToPosition3D(plane, 0, radius);
  }
  return angleToPosition3D(plane, angle, radius);
}

/** Calculate the rotation quaternion for a prop on a plane. */
export function calculatePropRotation(plane: Plane, staffAngle: number): Quaternion {
  return calculatePropQuaternion(plane, staffAngle);
}

/** Get the normal vector for a plane. */
export function getPlaneNormalVector(plane: Plane): Vector3 {
  return getPlaneNormal(plane);
}

/** Get all 8 grid location positions for a plane. */
export function getAllGridPositions(plane: Plane, radius: number = GRID_RADIUS_3D): Map<GridLocation, Vector3> {
  const positions = new Map<GridLocation, Vector3>();

  const locations = [
    GridLocation.NORTH,
    GridLocation.NORTHEAST,
    GridLocation.EAST,
    GridLocation.SOUTHEAST,
    GridLocation.SOUTH,
    GridLocation.SOUTHWEST,
    GridLocation.WEST,
    GridLocation.NORTHWEST,
  ];

  for (const location of locations) {
    positions.set(location, gridLocationToPosition3D(plane, location, radius));
  }

  return positions;
}
