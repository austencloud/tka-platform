/**
 * Shared position and rotation math for all 3D prop components.
 *
 * Extracted from Staff3D so every prop type uses the exact same
 * transform pipeline: body-local → facing rotation → world offset.
 */

import { Quaternion, Euler, Vector3 } from "three";
import type { PropState3D } from "../../domain/models/PropState3D";
import { Plane } from "../../domain/enums/Plane";
import { getPlaneRight } from "../../domain/constants/plane-transforms";

/**
 * Compute world-space position for a prop, given avatar position,
 * facing angle, and grid offset. Identical to Staff3D's position calc.
 */
export function computePropPosition(
  propState: PropState3D,
  avatarPosition: { x: number; y: number; z: number },
  facingAngle: number,
  gridOffset: number
): [number, number, number] {
  const localX = propState.worldPosition.x;
  // gridOffset pushes the wall-plane grid forward from the body.
  // Non-wall planes (wheel, floor) are centered on the body — no offset.
  const effectiveOffset = propState.plane === Plane.WALL ? gridOffset : 0;
  const localZ = propState.worldPosition.z + effectiveOffset;

  // In dual wheel mode, positions are already in world space (WHEEL = YZ).
  // Skip the facing rotation so they stay as actual wheel planes.
  if (propState.skipFacingTransform) {
    return [
      localX + avatarPosition.x,
      propState.worldPosition.y + avatarPosition.y,
      localZ + avatarPosition.z,
    ];
  }

  const cos = Math.cos(facingAngle);
  const sin = Math.sin(facingAngle);
  const rotatedX = localX * cos + localZ * sin;
  const rotatedZ = -localX * sin + localZ * cos;

  return [
    rotatedX + avatarPosition.x,
    propState.worldPosition.y + avatarPosition.y,
    rotatedZ + avatarPosition.z,
  ];
}

/**
 * Tilt a +Y cylinder to lie flat on a given plane.
 *
 * For WALL (right = +X): tilts Y → -X (staff horizontal in XY)
 * For WHEEL (right = -Z): tilts Y → +Z (staff horizontal in YZ)
 * For FLOOR (right = +X): tilts Y → -X (staff horizontal in XZ)
 *
 * The negation matches the existing wall convention where staffAngle=0
 * points the staff toward -right (stage left on wall plane).
 */
function getTiltQuat(plane: Plane): Quaternion {
  const right = getPlaneRight(plane);
  return new Quaternion().setFromUnitVectors(
    new Vector3(0, 1, 0),
    right.clone().negate()
  );
}

/**
 * Compute world-space rotation (Euler) for a prop that is naturally
 * vertical (cylinder along Y). Composes: plane-aware tilt → spin → facing.
 */
export function computePropRotation(
  propState: PropState3D,
  facingAngle: number
): [number, number, number] {
  // Tilt the cylinder to lie flat on the prop's plane
  const tiltQuat = getTiltQuat(propState.plane);

  // In dual wheel mode (skipFacingTransform), positions and rotations are
  // in world space. Apply spin + tilt but skip the facing rotation.
  if (propState.skipFacingTransform) {
    const finalQuat = propState.worldRotation.clone().multiply(tiltQuat);
    const euler = new Euler().setFromQuaternion(finalQuat);
    return [euler.x, euler.y, euler.z];
  }

  const facingQuat = new Quaternion().setFromEuler(
    new Euler(0, facingAngle, 0)
  );

  const finalQuat = facingQuat
    .clone()
    .multiply(propState.worldRotation)
    .multiply(tiltQuat);

  const euler = new Euler().setFromQuaternion(finalQuat);
  return [euler.x, euler.y, euler.z];
}

/**
 * Compute world-space rotation for a prop that is naturally flat/planar
 * (like a fan or hoop that lies in the XY plane).
 *
 * Uses the same plane-aware tilt as cylindrical props so the
 * fan's blade axis (+Y in local geometry) aligns correctly
 * regardless of which plane the prop is on.
 */
export function computeFlatPropRotation(
  propState: PropState3D,
  facingAngle: number
): [number, number, number] {
  const tiltQuat = getTiltQuat(propState.plane);

  const facingQuat = new Quaternion().setFromEuler(
    new Euler(0, facingAngle, 0)
  );

  const finalQuat = facingQuat
    .clone()
    .multiply(propState.worldRotation)
    .multiply(tiltQuat);

  const euler = new Euler().setFromQuaternion(finalQuat);
  return [euler.x, euler.y, euler.z];
}
