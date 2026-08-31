import type {
  EasingType,
  FormationSpot,
  StageChoreography,
} from "./stage-types";
import type {
  ScheduledGaitTimingSample,
  TerminalStepPlan,
} from "@austencloud/scene-3d";

const MOVEMENT_EPSILON = 0.0001;

export interface StagePerformanceFrame {
  performerId: string;
  stagePosition: { x: number; z: number };
  worldPosition: { x: number; z: number };
  bodyFacing: number;
  travelDirection: { x: number; z: number };
  moveDirection: { x: number; z: number };
  speedMetersPerSecond: number;
  isMoving: boolean;
  activeMarkIndex: number;
  transitionProgress: number;
  gaitTimingSample?: ScheduledGaitTimingSample;
  terminalStepPlan?: TerminalStepPlan;
}

export interface SequencePlaybackSample {
  stepIndex: number;
  progress: number;
}

export function applyStageEasing(t: number, easing: EasingType): number {
  switch (easing) {
    case "linear":
      return t;
    case "easeIn":
      return t * t;
    case "easeOut":
      return 1 - (1 - t) * (1 - t);
    case "easeInOut":
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }
}

export function easingDerivative(t: number, easing: EasingType): number {
  switch (easing) {
    case "linear":
      return 1;
    case "easeIn":
      return 2 * t;
    case "easeOut":
      return 2 * (1 - t);
    case "easeInOut":
      return t < 0.5 ? 4 * t : 4 * (1 - t);
  }
}

export function stageToWorld(
  position: { x: number; z: number },
  choreography: Pick<StageChoreography, "stageWidth" | "stageDepth">
): { x: number; z: number } {
  return {
    x: position.x - choreography.stageWidth / 2,
    // The top of the editor is the audience. In the 3D stage, the audience is
    // world +Z, so centering also reverses the editor's screen-down Z axis.
    z: choreography.stageDepth / 2 - position.z,
  };
}

export function segmentFacing(
  from: Pick<FormationSpot, "facingAngle">,
  to: Pick<FormationSpot, "facingAngle" | "walkStyle">,
  worldDx: number,
  worldDz: number
): number {
  if (to.facingAngle !== undefined) return to.facingAngle;
  if (to.walkStyle === "crab") return from.facingAngle ?? 0;
  return Math.hypot(worldDx, worldDz) > MOVEMENT_EPSILON
    ? Math.atan2(worldDx, worldDz)
    : (from.facingAngle ?? 0);
}

export function worldToBodyDirection(
  worldDirection: { x: number; z: number },
  bodyFacing: number
): { x: number; z: number } {
  const sin = Math.sin(bodyFacing);
  const cos = Math.cos(bodyFacing);
  return {
    x: worldDirection.x * cos - worldDirection.z * sin,
    z: worldDirection.x * sin + worldDirection.z * cos,
  };
}

/**
 * Avatar step zero is the authored start pose. Motion step one animates the
 * first beat, so a fractional choreography beat maps to step floor(beat) + 1.
 */
export function sampleSequencePlayback(
  beat: number,
  motionStepCount: number,
  loop: boolean
): SequencePlaybackSample {
  if (motionStepCount <= 0 || beat <= 0) return { stepIndex: 0, progress: 0 };

  if (!loop && beat >= motionStepCount) {
    return { stepIndex: motionStepCount, progress: 1 };
  }

  const sampledBeat = loop ? beat % motionStepCount : beat;
  if (loop && sampledBeat === 0) return { stepIndex: 0, progress: 0 };

  const motionIndex = Math.floor(sampledBeat);
  return {
    stepIndex: Math.min(motionStepCount, motionIndex + 1),
    progress: sampledBeat - motionIndex,
  };
}
