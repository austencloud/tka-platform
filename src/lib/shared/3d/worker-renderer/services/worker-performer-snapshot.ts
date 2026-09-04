import { cmToUnits, userProportionsState } from "@austencloud/scene-3d";
import type { CharacterInstanceState } from "../../state/character-instance-state.svelte";
import { resolvePerformerUpperBodyStance } from "../../domain/performer-upper-body-stance";
import { CANONICAL_PERFORMER_ANCHOR_Y } from "../../environments/domain/stage-coordinate-frame";
import type {
  WorkerPerformerSnapshot,
  WorkerPropSnapshot,
} from "../domain/worker-renderer-protocol";

const STAFF_PROP_TYPES = new Set([
  "staff",
  "simple_staff",
  "staff_v2",
  "bigstaff",
]);

export interface WorkerPerformerSnapshotOptions {
  leftPropType: string;
  rightPropType: string;
}

function serializeProp(
  state: CharacterInstanceState["leftPropState"],
): WorkerPropSnapshot | null {
  if (!state) return null;
  return {
    centerPathAngle: state.centerPathAngle,
    staffRotationAngle: state.staffRotationAngle,
    plane: state.plane,
    worldPosition: state.worldPosition.toArray(),
    worldRotation: state.worldRotation.toArray(),
    gripType: state.gripType,
  };
}

export function supportsWorkerPerformer(
  options: WorkerPerformerSnapshotOptions,
): boolean {
  return (
    STAFF_PROP_TYPES.has(options.leftPropType) &&
    STAFF_PROP_TYPES.has(options.rightPropType)
  );
}

/**
 * Serialize the app's already-resolved Choreo state without moving semantic
 * timing or plane math into the rendering worker.
 */
export function createWorkerPerformerSnapshot(
  performer: CharacterInstanceState,
  options: WorkerPerformerSnapshotOptions,
): WorkerPerformerSnapshot {
  const stance = resolvePerformerUpperBodyStance(performer);
  const staffLengthCm = performer.settings.staffLengthCm;
  return {
    id: performer.id,
    avatarId: performer.characterId,
    position: [
      performer.position.x,
      CANONICAL_PERFORMER_ANCHOR_Y,
      performer.position.z,
    ],
    facingAngle: performer.facingAngle,
    avatarHeightCm: userProportionsState.heightCm,
    groundY: userProportionsState.groundY,
    staffLength:
      staffLengthCm == null
        ? userProportionsState.staffLength
        : cmToUnits(staffLengthCm),
    staffThickness: userProportionsState.dimensions.staffRadius,
    leftPropType: options.leftPropType,
    rightPropType: options.rightPropType,
    leftProp: performer.showLeft ? serializeProp(performer.leftPropState) : null,
    rightProp: performer.showRight
      ? serializeProp(performer.rightPropState)
      : null,
    stanceYaw: stance.yawRad,
    stanceSegments: stance.segments,
    spinePitchOffset: stance.pitchRad,
  };
}
