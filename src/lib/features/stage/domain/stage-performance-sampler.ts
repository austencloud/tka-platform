import type {
  EasingType,
  Mark,
  Performer,
  StageChoreography,
} from "./stage-types";

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

function easingDerivative(t: number, easing: EasingType): number {
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

function stageToWorld(
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

function totalBeats(performer: Performer): number {
  return performer.marks.reduce((sum, mark) => sum + mark.beats, 0);
}

function stationaryFrame(
  performer: Performer,
  mark: Mark,
  markIndex: number,
  choreography: Pick<StageChoreography, "stageWidth" | "stageDepth">
): StagePerformanceFrame {
  const stagePosition = { x: mark.x, z: mark.z };
  return {
    performerId: performer.id,
    stagePosition,
    worldPosition: stageToWorld(stagePosition, choreography),
    bodyFacing: mark.facingAngle ?? 0,
    travelDirection: { x: 0, z: 0 },
    moveDirection: { x: 0, z: 0 },
    speedMetersPerSecond: 0,
    isMoving: false,
    activeMarkIndex: markIndex,
    transitionProgress: 1,
  };
}

function segmentFacing(
  from: Mark,
  to: Mark,
  worldDx: number,
  worldDz: number
): number {
  if (to.facingAngle !== undefined) return to.facingAngle;
  if (to.walkStyle === "crab") return from.facingAngle ?? 0;
  return Math.hypot(worldDx, worldDz) > MOVEMENT_EPSILON
    ? Math.atan2(worldDx, worldDz)
    : (from.facingAngle ?? 0);
}

function worldToBodyDirection(
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

export function samplePerformerPerformance(
  performer: Performer,
  choreography: Pick<StageChoreography, "bpm" | "stageWidth" | "stageDepth">,
  beat: number
): StagePerformanceFrame {
  const first = performer.marks[0];
  if (!first) {
    const center: Mark = {
      id: "empty-stage-center",
      x: choreography.stageWidth / 2,
      z: choreography.stageDepth / 2,
      beats: 0,
      walkStyle: "direct",
      easing: "linear",
    };
    return stationaryFrame(performer, center, 0, choreography);
  }
  if (performer.marks.length === 1 || beat <= 0) {
    return stationaryFrame(performer, first, 0, choreography);
  }

  const performerTotalBeats = totalBeats(performer);
  if (beat >= performerTotalBeats) {
    const lastIndex = performer.marks.length - 1;
    const last = performer.marks[lastIndex]!;
    const previous = performer.marks[lastIndex - 1] ?? last;
    const worldFrom = stageToWorld(previous, choreography);
    const worldTo = stageToWorld(last, choreography);
    return {
      ...stationaryFrame(performer, last, lastIndex, choreography),
      bodyFacing: segmentFacing(
        previous,
        last,
        worldTo.x - worldFrom.x,
        worldTo.z - worldFrom.z
      ),
    };
  }

  let accumulatedBeats = 0;
  for (let index = 1; index < performer.marks.length; index += 1) {
    const to = performer.marks[index]!;
    const from = performer.marks[index - 1]!;
    const segmentStart = accumulatedBeats;
    accumulatedBeats += to.beats;
    if (beat > accumulatedBeats && index < performer.marks.length - 1) continue;

    const rawProgress =
      to.beats > 0
        ? Math.max(0, Math.min(1, (beat - segmentStart) / to.beats))
        : 1;
    const transitionProgress = applyStageEasing(rawProgress, to.easing);
    const stagePosition = {
      x: from.x + (to.x - from.x) * transitionProgress,
      z: from.z + (to.z - from.z) * transitionProgress,
    };
    const worldFrom = stageToWorld(from, choreography);
    const worldTo = stageToWorld(to, choreography);
    const worldDx = worldTo.x - worldFrom.x;
    const worldDz = worldTo.z - worldFrom.z;
    const distance = Math.hypot(worldDx, worldDz);
    const travelDirection =
      distance > MOVEMENT_EPSILON
        ? { x: worldDx / distance, z: worldDz / distance }
        : { x: 0, z: 0 };
    const bodyFacing = segmentFacing(from, to, worldDx, worldDz);
    const durationSeconds =
      to.beats > 0 ? (to.beats * 60) / choreography.bpm : 0;
    const averageSpeed = durationSeconds > 0 ? distance / durationSeconds : 0;
    const speedMetersPerSecond =
      averageSpeed * easingDerivative(rawProgress, to.easing);

    return {
      performerId: performer.id,
      stagePosition,
      worldPosition: stageToWorld(stagePosition, choreography),
      bodyFacing,
      travelDirection,
      moveDirection: worldToBodyDirection(travelDirection, bodyFacing),
      speedMetersPerSecond,
      isMoving: speedMetersPerSecond > MOVEMENT_EPSILON,
      activeMarkIndex: index,
      transitionProgress,
    };
  }

  return stationaryFrame(
    performer,
    performer.marks.at(-1) ?? first,
    performer.marks.length - 1,
    choreography
  );
}

export function sampleStagePerformance(
  choreography: StageChoreography,
  beat: number
): StagePerformanceFrame[] {
  return choreography.performers.map((performer) =>
    samplePerformerPerformance(performer, choreography, beat)
  );
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
