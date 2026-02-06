/**
 * PropState3D - Extended prop state for 3D animation
 *
 * Extends the 2D PropState with plane context and 3D position/rotation.
 */

import type { Vector3, Quaternion } from "three";
import type { Plane } from "../enums/Plane";

/**
 * 2D prop state (matches existing animation-engine PropState)
 */
export interface PropState2D {
  /** Position angle on the circular grid path (radians) */
  centerPathAngle: number;
  /** Staff/prop rotation angle (radians) */
  staffRotationAngle: number;
  /** Optional X coordinate for DASH motions */
  x?: number;
  /** Optional Y coordinate for DASH motions */
  y?: number;
}

/**
 * 3D prop state extending 2D with plane and world-space transforms
 */
export interface PropState3D extends PropState2D {
  /** Which plane this prop is operating on */
  plane: Plane;
  /** 3D world position (computed from plane + angle) */
  worldPosition: Vector3;
  /** 3D rotation quaternion (computed from plane + staffAngle) */
  worldRotation: Quaternion;
}

/**
 * Container for both props' 3D state
 */
export interface PropStates3D {
  blue: PropState3D;
  red: PropState3D;
}

/**
 * Interpolation result for a single frame
 */
export interface InterpolationResult3D {
  blue: PropState3D;
  red: PropState3D;
  isValid: boolean;
}
