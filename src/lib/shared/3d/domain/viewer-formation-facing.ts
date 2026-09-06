import { calculateFacingAngle } from "@austencloud/scene-3d";
import { SceneEnvironmentId } from "../environments/domain/scene-environment";

// The package exports `calculateFacingAngle` but not the `Formation`/
// `FormationSlot` types its signature is built from, so derive them from the
// function itself rather than re-declaring the shapes by hand.
type FormationSlot = Parameters<typeof calculateFacingAngle>[0];
type Formation = Parameters<typeof calculateFacingAngle>[1];

/**
 * Most hero scenes were authored around the performer's original zero heading,
 * which shows their face to the opening camera. Ember and the Blossom garden
 * look down the opposite stage axis and start with a half-turn.
 */
export const DEFAULT_VIEWER_FRONT_STAGE_FACING_ANGLE = 0;
export const EMBER_VIEWER_FRONT_STAGE_FACING_ANGLE = Math.PI;

/**
 * The camera and performer heading are one presentation contract. Hero scenes
 * open from positive Z while Ember and Blossom's compositions open from negative
 * Z. Keeping the signs beside the headings prevents another scene-specific
 * reversal from leaking into the shared camera choreography.
 */
export const DEFAULT_VIEWER_FRONT_STAGE_CAMERA_Z_SIGN = 1;
export const EMBER_VIEWER_FRONT_STAGE_CAMERA_Z_SIGN = -1;

export function getViewerFrontStageFacingAngle(
  environmentId: SceneEnvironmentId
): number {
  return environmentId === SceneEnvironmentId.EMBER ||
    environmentId === SceneEnvironmentId.BLOSSOM
    ? EMBER_VIEWER_FRONT_STAGE_FACING_ANGLE
    : DEFAULT_VIEWER_FRONT_STAGE_FACING_ANGLE;
}

export function getViewerFrontStageCameraZ(
  targetZ: number,
  distance: number,
  environmentId: SceneEnvironmentId
): number {
  const cameraZSign =
    environmentId === SceneEnvironmentId.EMBER ||
    environmentId === SceneEnvironmentId.BLOSSOM
      ? EMBER_VIEWER_FRONT_STAGE_CAMERA_Z_SIGN
      : DEFAULT_VIEWER_FRONT_STAGE_CAMERA_Z_SIGN;
  return targetZ + Math.abs(distance) * cameraZSign;
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
