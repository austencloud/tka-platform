/**
 * Shared rotation math for all 3D prop components.
 *
 * Position is handled by the PerformerRig scene graph hierarchy.
 * This file only handles rotation: horizontal tilt + plane/staff quaternion.
 * Facing rotation is inherited from the parent PerformerRig group.
 */

import { Quaternion, Euler } from "three";
import type { PropState3D } from "../../domain/models/PropState3D";

/**
 * Base tilt quaternion: lays a +Y cylinder horizontal (along -X).
 * Applied before worldRotation which handles plane + staff spin.
 */
const HORIZONTAL_QUAT = new Quaternion().setFromEuler(
  new Euler(0, 0, Math.PI / 2)
);

/**
 * Compute local-space rotation (Euler) for any prop type.
 *
 * Composition: worldRotation x horizontalQuat
 * - horizontalQuat: lays cylinder horizontal (Y -> -X)
 * - worldRotation: planeQuat x staffSpin (from calculatePropQuaternion)
 *
 * Facing rotation is NOT applied here - the parent PerformerRig group handles it.
 * Works for both cylindrical (staff, club) and flat (fan, hoop) props.
 */
export function computePropRotation(
  propState: PropState3D,
): [number, number, number] {
  const finalQuat = propState.worldRotation.clone().multiply(HORIZONTAL_QUAT);
  const euler = new Euler().setFromQuaternion(finalQuat);
  return [euler.x, euler.y, euler.z];
}
