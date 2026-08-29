import {
  calculateFacingAngle,
  type Formation,
  type FormationSlot,
} from "@austencloud/scene-3d";

/**
 * Viewer3D's hero environments are composed beyond the positive-Z stage edge.
 * The shared performer rig faces positive Z at zero rotation, so a half-turn
 * points performers toward the negative-Z audience camera while the hero vista
 * remains behind them. This adapter is the one place where formation intent
 * enters the Viewer3D camera frame.
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
