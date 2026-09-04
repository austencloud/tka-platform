import { cmToUnits, userProportionsState } from "@austencloud/scene-3d";
import type { CharacterInstanceState } from "../../state/character-instance-state.svelte";
import { resolvePerformerUpperBodyStance } from "../../domain/performer-upper-body-stance";
import { CANONICAL_PERFORMER_ANCHOR_Y } from "../../environments/domain/stage-coordinate-frame";
import type {
  WorkerPerformerEffectIntent,
  WorkerPerformerSnapshot,
  WorkerPerformerPropType,
  WorkerPropSnapshot,
  WorkerSelectionMarkerSnapshot,
} from "../domain/worker-renderer-protocol";
import { isWorkerPerformerPropType } from "../domain/worker-renderer-protocol";
import { getPerformerColor } from "../../constants/performer-colors";
import type { WorkerPropBuild } from "../worlds/props/worker-prop-factory-types";
import { isWorkerEffectExact } from "../effects/worker-effect-support";

export interface WorkerPerformerSnapshotOptions {
  leftPropType: string;
  rightPropType: string;
  propBuild: WorkerPropBuild;
  enableLocomotion?: boolean;
  badge?: {
    index: number;
    selected: boolean;
    allMode: boolean;
    visible: boolean;
  };
  selectionMarker?: Omit<WorkerSelectionMarkerSnapshot, "groundPosition">;
  effectIntent?: WorkerPerformerEffectIntent | null;
}

type SupportedWorkerPerformerSnapshotOptions =
  WorkerPerformerSnapshotOptions & {
    leftPropType: WorkerPerformerPropType;
    rightPropType: WorkerPerformerPropType;
  };

function serializeProp(
  state: CharacterInstanceState["leftPropState"]
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
  options: WorkerPerformerSnapshotOptions
): options is SupportedWorkerPerformerSnapshotOptions {
  return (
    isWorkerPerformerPropType(options.leftPropType) &&
    isWorkerPerformerPropType(options.rightPropType)
  );
}

function assertExactEffectIntent(
  intent: WorkerPerformerEffectIntent | null | undefined
): void {
  if (!intent) return;
  for (const decision of intent.tips) {
    if (!isWorkerEffectExact(decision.effect)) {
      throw new Error(
        `Worker performer cannot reproduce ${decision.effect} exactly`
      );
    }
    if (
      decision.effect !== "none" &&
      decision.effect !== "trails" &&
      decision.effect !== "led" &&
      !intent.pooled[decision.effect]
    ) {
      throw new Error(
        `Worker performer is missing resolved ${decision.effect} parameters`
      );
    }
  }
}

/**
 * Serialize the app's already-resolved Choreo state without moving semantic
 * timing or plane math into the rendering worker.
 */
export function createWorkerPerformerSnapshot(
  performer: CharacterInstanceState,
  options: WorkerPerformerSnapshotOptions
): WorkerPerformerSnapshot {
  if (!supportsWorkerPerformer(options)) {
    throw new Error(
      `Worker performer cannot reproduce ${options.leftPropType}/${options.rightPropType} exactly`
    );
  }
  assertExactEffectIntent(options.effectIntent);
  if (
    options.effectIntent &&
    (options.effectIntent.propBuild.finish !== options.propBuild.finish ||
      options.effectIntent.propBuild.fanBuild !== options.propBuild.fanBuild ||
      options.effectIntent.propBuild.fanFrameColor !==
        options.propBuild.fanFrameColor ||
      options.effectIntent.propBuild.fanCover !== options.propBuild.fanCover)
  ) {
    throw new Error(
      "Worker performer effect intent uses a different prop build"
    );
  }
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
    propBuild: { ...options.propBuild },
    leftPropType: options.leftPropType,
    rightPropType: options.rightPropType,
    leftProp: performer.showLeft
      ? serializeProp(performer.leftPropState)
      : null,
    rightProp: performer.showRight
      ? serializeProp(performer.rightPropState)
      : null,
    stanceYaw: stance.yawRad,
    stanceSegments: stance.segments,
    spinePitchOffset: stance.pitchRad,
    badge: options.badge?.visible
      ? {
          index: options.badge.index,
          color: getPerformerColor(options.badge.index),
          opacity: options.badge.selected
            ? 1
            : options.badge.allMode
              ? 0.6
              : 0.35,
          selected: options.badge.selected,
        }
      : null,
    selectionMarker: options.selectionMarker
      ? {
          ...options.selectionMarker,
          groundPosition: [
            performer.position.x,
            userProportionsState.groundY + CANONICAL_PERFORMER_ANCHOR_Y,
            performer.position.z,
          ],
        }
      : null,
    effectIntent: options.effectIntent
      ? structuredClone(options.effectIntent)
      : null,
    locomotion: options.enableLocomotion
      ? {
          isMoving: performer.isMoving,
          moveSpeed: performer.moveSpeed,
          moveDirection: {
            x: performer.moveDirection.x,
            z: performer.moveDirection.z,
          },
          lateralGait: "sidestep",
          gaitTimingSample: performer.gaitTimingSample
            ? { ...performer.gaitTimingSample }
            : null,
          terminalStepPlan: performer.terminalStepPlan
            ? {
                ...performer.terminalStepPlan,
                stepDistances: [
                  ...performer.terminalStepPlan.stepDistances,
                ] as [number, number],
              }
            : null,
          // The production viewer does not currently schedule authored root
          // turns: every supported plane mode keeps body heading at zero.
          // Keep the protocol lane explicit so a future app-owned planner can
          // supply a real request without moving that decision into rendering.
          turnRequest: null,
        }
      : null,
  };
}
