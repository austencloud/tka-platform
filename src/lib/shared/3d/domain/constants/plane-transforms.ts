/**
 * Plane Transform Constants
 *
 * Defines the mathematical transformations for converting 2D angles
 * to 3D world coordinates based on plane context.
 *
 * Uses Three.js Y-up convention:
 * - X = performer's right (positive)
 * - Y = sky (positive)
 * - Z = toward audience (positive)
 */

import { Vector3, Euler, Quaternion } from "three";
import { Plane } from "../enums/Plane";

/**
 * Scale: 1 unit = 1 meter (unified meters scale)
 *
 * Grid radius is calculated as: staffLength * HAND_RADIUS_STAFF_RATIO (0.6)
 * For a 34" staff: 34" * 2.54 cm/in * 0.01 m/cm * 0.6 = ~0.52 meters
 *
 * This matches the handPointRadius calculation in user-proportions.ts
 * to ensure props align with grid point markers.
 */

/**
 * Default grid radius in meters.
 * This determines the distance from center to hand points.
 * Matches handPointRadius for default 34" staff (86.4cm * 0.01 * 0.6 ≈ 0.52m)
 *
 * TODO: This should eventually be passed dynamically based on user proportions
 * rather than hardcoded. For now, it matches the default staff size.
 */
export const GRID_RADIUS_3D = 0.52;

/**
 * Conversion factor from 2D canvas (950x950) to 3D meters
 * ~143px is the 2D hand point radius in canvas coords
 */
export const CANVAS_TO_3D_SCALE = GRID_RADIUS_3D / 143;

/**
 * Convert a 2D path angle to a 3D world position on the specified plane.
 *
 * The angle follows the existing 2D convention:
 * - E = 0, S = π/2, W = π, N = -π/2 (canvas Y-down)
 *
 * This function maps those angles to 3D positions where:
 * - Each plane interprets N/E/S/W relative to its canonical viewpoint
 * - Y-axis inversion is applied (canvas Y-down → Three.js Y-up)
 *
 * @param plane - Which plane the position is on
 * @param angle - Path angle in radians (uses LOCATION_ANGLES convention)
 * @param radius - Distance from center (default: GRID_RADIUS_3D)
 * @returns Vector3 world position
 */
export function planeAngleToWorldPosition(
  plane: Plane,
  angle: number,
  radius: number = GRID_RADIUS_3D
): Vector3 {
  const cos_a = Math.cos(angle);
  const sin_a = Math.sin(angle);

  switch (plane) {
    case Plane.WALL:
      // XY plane: E(0)→+X(right), N(-π/2)→+Y(up), S(π/2)→-Y(down), W(π)→-X(left)
      // From behind (camera at -Z): +X = screen right = performer's right = east ✓
      // Y inversion: canvas sin (Y-down) becomes -sin (Y-up)
      return new Vector3(cos_a * radius, -sin_a * radius, 0);

    case Plane.WHEEL:
      // YZ plane: X=0, Y=up, Z=toward audience
      return new Vector3(0, -sin_a * radius, -cos_a * radius);

    case Plane.FLOOR:
      // XZ plane: E(0)→+X(right), N(-π/2)→+Z(forward)
      return new Vector3(cos_a * radius, 0, sin_a * radius);

    default:
      return new Vector3(cos_a * radius, -sin_a * radius, 0);
  }
}

/**
 * Get the normal vector for a plane (points toward canonical viewer)
 */
export function getPlaneNormal(plane: Plane): Vector3 {
  switch (plane) {
    case Plane.WALL:
      return new Vector3(0, 0, 1); // Points toward audience
    case Plane.WHEEL:
      return new Vector3(1, 0, 0); // Points toward performer's right
    case Plane.FLOOR:
      return new Vector3(0, 1, 0); // Points up
    default:
      return new Vector3(0, 0, 1);
  }
}

/**
 * Get the "up" direction within a plane (what direction is "N")
 */
export function getPlaneUp(plane: Plane): Vector3 {
  switch (plane) {
    case Plane.WALL:
      return new Vector3(0, 1, 0); // N = up
    case Plane.WHEEL:
      return new Vector3(0, 1, 0); // N = up
    case Plane.FLOOR:
      return new Vector3(0, 0, -1); // N = toward audience (but -Z in floor coords)
    default:
      return new Vector3(0, 1, 0);
  }
}

/**
 * Get the "right" direction within a plane (what direction is "E")
 */
export function getPlaneRight(plane: Plane): Vector3 {
  switch (plane) {
    case Plane.WALL:
      return new Vector3(1, 0, 0); // E = performer's right
    case Plane.WHEEL:
      return new Vector3(0, 0, -1); // E = toward audience
    case Plane.FLOOR:
      return new Vector3(1, 0, 0); // E = performer's right
    default:
      return new Vector3(1, 0, 0);
  }
}

/**
 * Get the Euler rotation to orient an object to lie flat on a plane
 */
export function getPlaneRotation(plane: Plane): Euler {
  switch (plane) {
    case Plane.WALL:
      return new Euler(0, 0, 0);
    case Plane.WHEEL:
      return new Euler(0, Math.PI / 2, 0);
    case Plane.FLOOR:
      return new Euler(-Math.PI / 2, 0, 0);
    default:
      return new Euler(0, 0, 0);
  }
}

/**
 * Get the quaternion to orient an object to lie flat on a plane
 */
export function getPlaneQuaternion(plane: Plane): Quaternion {
  const euler = getPlaneRotation(plane);
  return new Quaternion().setFromEuler(euler);
}

/**
 * Calculate prop/staff rotation quaternion.
 * Combines plane orientation with staff angle rotation.
 *
 * IMPORTANT: Staff angles use 2D canvas convention (Y-down, CW = positive).
 * Three.js uses Y-up convention where positive rotation = CCW.
 * We negate the angle to convert from canvas to Three.js convention.
 *
 * @param plane - The plane the prop is on
 * @param staffAngle - Staff rotation angle in radians (canvas convention)
 * @returns Quaternion for prop orientation
 */
export function calculatePropQuaternion(
  plane: Plane,
  staffAngle: number
): Quaternion {
  // Start with plane base orientation
  const planeQuat = getPlaneQuaternion(plane);

  // Add staff rotation around the plane's normal
  // Negate angle to convert from canvas (Y-down) to Three.js (Y-up)
  const normal = getPlaneNormal(plane);
  const staffQuat = new Quaternion().setFromAxisAngle(normal, -staffAngle);

  // Combine: plane orientation first, then staff rotation
  return planeQuat.clone().multiply(staffQuat);
}
