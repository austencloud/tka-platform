import { Vector3 } from "three";

/**
 * Derives the knee's sagittal hinge axis from the rest-pose directions
 * of the UpLeg and Leg bones.
 *
 * Called once at skeleton-build time, not per-frame.
 */
export function computeKneeHingeAxis(upLegRestDir: Vector3, legRestDir: Vector3): Vector3 {
  const axis = new Vector3().crossVectors(upLegRestDir, legRestDir);
  if (axis.lengthSq() < 1e-6) {
    return new Vector3(1, 0, 0);
  }
  return axis.normalize();
}
