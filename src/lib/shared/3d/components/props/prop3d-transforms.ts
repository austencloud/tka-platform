/**
 * Shared position and rotation math for all 3D prop components.
 *
 * Extracted from Staff3D so every prop type uses the exact same
 * transform pipeline: body-local → facing rotation → world offset.
 */

import { Quaternion, Euler, Vector3 } from "three";
import type { PropState3D } from "../../domain/models/PropState3D";
import { Plane } from "../../domain/enums/Plane";

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
 * Base tilt quaternion: lays a +Y cylinder horizontal (along -X).
 * This is the starting orientation BEFORE worldRotation is applied.
 *
 * worldRotation (from calculatePropQuaternion) already includes planeQuat
 * which handles the plane-specific orientation. So we always use the same
 * base tilt — no plane-specific logic here.
 *
 * Single source of truth: plane orientation lives in calculatePropQuaternion.
 * This function is just "make the cylinder not vertical."
 */
const HORIZONTAL_QUAT = new Quaternion().setFromEuler(
  new Euler(0, 0, Math.PI / 2)
);

/**
 * Compute world-space rotation (Euler) for a prop that is naturally
 * vertical (cylinder along Y).
 *
 * Composition: facingQuat × worldRotation × horizontalQuat
 * - horizontalQuat: lays cylinder horizontal (Y → -X)
 * - worldRotation: planeQuat × staffSpin (from calculatePropQuaternion)
 * - facingQuat: avatar's facing direction
 *
 * The plane-specific rotation is entirely inside worldRotation.
 * This prevents drift — plane logic lives in ONE place (calculatePropQuaternion).
 */
export function computePropRotation(
  propState: PropState3D,
  facingAngle: number
): [number, number, number] {
  // In dual wheel mode (skipFacingTransform), skip the facing rotation.
  if (propState.skipFacingTransform) {
    const finalQuat = propState.worldRotation.clone().multiply(HORIZONTAL_QUAT);
    const euler = new Euler().setFromQuaternion(finalQuat);
    return [euler.x, euler.y, euler.z];
  }

  const facingQuat = new Quaternion().setFromEuler(
    new Euler(0, facingAngle, 0)
  );

  const finalQuat = facingQuat
    .clone()
    .multiply(propState.worldRotation)
    .multiply(HORIZONTAL_QUAT);

  const euler = new Euler().setFromQuaternion(finalQuat);
  return [euler.x, euler.y, euler.z];
}

/**
 * Compute world-space rotation for a prop that is naturally flat/planar
 * (like a fan or hoop). Same composition as cylindrical props.
 */
export function computeFlatPropRotation(
  propState: PropState3D,
  facingAngle: number
): [number, number, number] {
  const facingQuat = new Quaternion().setFromEuler(
    new Euler(0, facingAngle, 0)
  );

  const finalQuat = facingQuat
    .clone()
    .multiply(propState.worldRotation)
    .multiply(HORIZONTAL_QUAT);

  const euler = new Euler().setFromQuaternion(finalQuat);
  return [euler.x, euler.y, euler.z];
}
