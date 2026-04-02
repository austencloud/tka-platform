/**
 * Shared position and rotation math for all 3D prop components.
 *
 * Extracted from Staff3D so every prop type uses the exact same
 * transform pipeline: body-local → facing rotation → world offset.
 */

import { Quaternion, Euler } from "three";
import type { PropState3D } from "../../domain/models/PropState3D";

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
 * (like a fan or hoop that lies in the XY plane). No horizontal tilt needed.
 */
export function computeFlatPropRotation(
  propState: PropState3D,
  facingAngle: number
): [number, number, number] {
  const facingQuat = new Quaternion().setFromEuler(
    new Euler(0, facingAngle, 0)
  );

  const finalQuat = facingQuat.clone().multiply(propState.worldRotation);

  const euler = new Euler().setFromQuaternion(finalQuat);
  return [euler.x, euler.y, euler.z];
}
