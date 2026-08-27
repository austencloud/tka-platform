import {
  calculateFacingAngle,
  type Formation,
  type FormationSlot,
} from "@austencloud/scene-3d";

/**
 * Viewer3D's audience camera begins on the negative-Z side of the stage. The
 * shared formation package uses positive Z as its generic forward direction,
 * so its same-direction heading would show the audience every performer's
 * back. This adapter is the one place where formation intent enters the
 * Viewer3D camera frame.
 */
export const VIEWER_FRONT_STAGE_FACING_ANGLE = Math.PI;

export function resolveViewerFormationFacingAngle(
  slot: FormationSlot | undefined,
  formation: Formation,
  fallbackAngle: number
): number {
  if (slot?.facingAngle !== undefined) return slot.facingAngle;
  if (formation.facingMode === "same-direction") {
    return VIEWER_FRONT_STAGE_FACING_ANGLE;
  }
  return slot ? calculateFacingAngle(slot, formation) : fallbackAngle;
}
