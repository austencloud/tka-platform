import {
  calculateFacingAngle,
  type Formation,
  type FormationSlot,
} from "@austencloud/scene-3d";
import { SceneEnvironmentId } from "../environments/domain/scene-environment";

/**
 * Most hero scenes were authored around the performer's original zero heading,
 * which shows their face to the opening camera. Ember deliberately looks down
 * the opposite stage axis, so it alone starts with a half-turn.
 */
export const DEFAULT_VIEWER_FRONT_STAGE_FACING_ANGLE = 0;
export const EMBER_VIEWER_FRONT_STAGE_FACING_ANGLE = Math.PI;

export function getViewerFrontStageFacingAngle(
  environmentId: SceneEnvironmentId
): number {
  return environmentId === SceneEnvironmentId.EMBER
    ? EMBER_VIEWER_FRONT_STAGE_FACING_ANGLE
    : DEFAULT_VIEWER_FRONT_STAGE_FACING_ANGLE;
}

export function resolveViewerFormationFacingAngle(
  slot: FormationSlot | undefined,
  formation: Formation,
  fallbackAngle: number,
  frontStageFacingAngle = DEFAULT_VIEWER_FRONT_STAGE_FACING_ANGLE
): number {
  if (slot?.facingAngle !== undefined) return slot.facingAngle;
  if (formation.facingMode === "same-direction") {
    return frontStageFacingAngle;
  }
  return slot ? calculateFacingAngle(slot, formation) : fallbackAngle;
}
