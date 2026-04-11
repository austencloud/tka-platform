import { Vector3 } from "three";

/**
 * Derives the knee's sagittal hinge axis from the rest-pose directions
 * of the UpLeg and Leg bones. The axis is the cross product of the
 * two rest directions, normalized. This is the axis perpendicular to
 * the natural bend plane — rotating around it bends the knee forward
 * or backward but never sideways.
 *
 * Called once at skeleton-build time, not per-frame, so allocation
 * is fine here (unlike the IK hot path which uses pooled temps).
 *
 * Fallback: if the two rest directions are nearly parallel (straight
 * leg in bind pose, cross product near zero), returns world +X which
 * is the sagittal axis for a character facing +Z (the TKA scene
 * convention).
 */
export class KneeHingeAxisCalibrator {
  compute(upLegRestDir: Vector3, legRestDir: Vector3): Vector3 {
    const axis = new Vector3().crossVectors(upLegRestDir, legRestDir);
    if (axis.lengthSq() < 1e-6) {
      return new Vector3(1, 0, 0);
    }
    return axis.normalize();
  }
}
