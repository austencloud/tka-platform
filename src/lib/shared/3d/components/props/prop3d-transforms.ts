/**
 * Shared position and rotation math for all 3D prop components.
 *
 * Extracted from Staff3D so every prop type uses the exact same
 * transform pipeline: body-local → facing rotation → world offset.
 */

import { Quaternion, Euler, Vector3 } from "three";
import type { PropState3D } from "../../domain/models/PropState3D";
import { getPlaneNormal } from "../../domain/constants/plane-transforms";

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
  const localZ = propState.worldPosition.z + gridOffset;

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
 * Compute world-space rotation (Euler) for a prop that is naturally
 * vertical (cylinder along Y). Composes: horizontal tilt → world rotation → facing.
 */
export function computePropRotation(
  propState: PropState3D,
  facingAngle: number
): [number, number, number] {
  // Cylinder is vertical by default (along Y). Rotate 90° around Z to make horizontal.
  const horizontalQuat = new Quaternion().setFromEuler(
    new Euler(0, 0, Math.PI / 2)
  );

  // In dual wheel mode, position and rotation are in world space.
  // The worldRotation from calculatePropQuaternion includes a planeQuat
  // that orients into the plane's local frame — but we're already in
  // world space, so that extra rotation puts the spin on the wrong axis.
  // Instead, rotate the staff directly around the plane's normal vector.
  if (propState.skipFacingTransform) {
    const normal = getPlaneNormal(propState.plane);
    const staffQuat = new Quaternion().setFromAxisAngle(
      normal,
      propState.staffRotationAngle
    );
    const finalQuat = staffQuat.multiply(horizontalQuat);
    const euler = new Euler().setFromQuaternion(finalQuat);
    return [euler.x, euler.y, euler.z];
  }

  const facingQuat = new Quaternion().setFromEuler(
    new Euler(0, facingAngle, 0)
  );

  const finalQuat = facingQuat
    .clone()
    .multiply(propState.worldRotation)
    .multiply(horizontalQuat);

  const euler = new Euler().setFromQuaternion(finalQuat);
  return [euler.x, euler.y, euler.z];
}

/**
 * Compute world-space rotation for a prop that is naturally flat/planar
 * (like a fan or hoop that lies in the XY plane).
 *
 * Applies the same 90° Z base rotation as cylindrical props so the
 * fan's blade axis (+Y in local geometry) aligns with the direction
 * the worldRotation quaternion expects.  Without this, fans appear
 * rotated 90° relative to their 2D orientation.
 */
export function computeFlatPropRotation(
  propState: PropState3D,
  facingAngle: number
): [number, number, number] {
  // Same base rotation as staves: align local +Y with the axis
  // the worldRotation quaternion was computed for.
  const baseQuat = new Quaternion().setFromEuler(
    new Euler(0, 0, Math.PI / 2)
  );

  const facingQuat = new Quaternion().setFromEuler(
    new Euler(0, facingAngle, 0)
  );

  const finalQuat = facingQuat
    .clone()
    .multiply(propState.worldRotation)
    .multiply(baseQuat);

  const euler = new Euler().setFromQuaternion(finalQuat);
  return [euler.x, euler.y, euler.z];
}
