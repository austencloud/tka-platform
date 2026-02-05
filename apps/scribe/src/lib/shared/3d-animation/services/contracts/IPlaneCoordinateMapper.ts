/**
 * IPlaneCoordinateMapper Interface
 *
 * Service contract for converting between 2D plane coordinates and 3D world space.
 */

import type { Vector3, Quaternion } from "three";
import type { Plane } from "../../domain/enums/Plane";
import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

export interface IPlaneCoordinateMapper {
  /**
   * Convert a path angle on a plane to a 3D world position.
   *
   * @param plane - Which plane the position is on
   * @param angle - Path angle in radians (uses LOCATION_ANGLES convention)
   * @param radius - Distance from center (optional, uses default)
   * @returns Vector3 world position
   */
  angleToPosition3D(plane: Plane, angle: number, radius?: number): Vector3;

  /**
   * Convert a GridLocation on a plane to a 3D world position.
   *
   * @param plane - Which plane the position is on
   * @param location - Grid location (N, E, S, W, etc.)
   * @param radius - Distance from center (optional)
   * @returns Vector3 world position
   */
  gridLocationToPosition3D(
    plane: Plane,
    location: GridLocation,
    radius?: number
  ): Vector3;

  /**
   * Calculate the rotation quaternion for a prop on a plane.
   *
   * @param plane - The plane the prop is on
   * @param staffAngle - Staff rotation angle in radians
   * @returns Quaternion for prop orientation
   */
  calculatePropRotation(plane: Plane, staffAngle: number): Quaternion;

  /**
   * Get the normal vector for a plane.
   */
  getPlaneNormal(plane: Plane): Vector3;

  /**
   * Get all 8 grid location positions for a plane.
   *
   * @param plane - Which plane
   * @param radius - Distance from center
   * @returns Map of GridLocation to Vector3
   */
  getAllGridPositions(
    plane: Plane,
    radius?: number
  ): Map<GridLocation, Vector3>;
}
