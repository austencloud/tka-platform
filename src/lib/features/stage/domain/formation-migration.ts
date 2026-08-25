/**
 * The pre-formation storage model, and everything needed to read it.
 *
 * Stage used to store choreography as a per-performer list of marks — a
 * position plus the count it takes to walk there. It stores whole-cast
 * formations now, but documents saved by the old build still exist, so this
 * module reads them and converts. Nothing here is part of the live domain:
 * `Mark` and the walk sampler live here rather than in `stage-types.ts` and
 * `stage-performance-sampler.ts` so that the legacy model has exactly one home
 * and cannot leak back into the editor.
 */
import {
  applyStageEasing,
  easingDerivative,
  segmentFacing,
  stageToWorld,
  worldToBodyDirection,
  type StagePerformanceFrame,
} from "./stage-performance-sampler";
import type {
  EasingType,
  Formation,
  StageChoreography,
  WalkStyle,
} from "./stage-types";

const MOVEMENT_EPSILON = 0.0001;

export interface Mark {
  id: string;
  x: number;
  z: number;
  beats: number;
  walkStyle: WalkStyle;
  easing: EasingType;
  /** Explicit performance-facing yaw. Undefined keeps the legacy walk-style default. */
  facingAngle?: number;
}

export interface LegacyPerformer {
  id: string;
  marks: Mark[];
}

type SamplingChoreography = Pick<
  StageChoreography,
  "bpm" | "stageWidth" | "stageDepth"
>;

function totalBeats(performer: LegacyPerformer): number {
  return performer.marks.reduce((sum, mark) => sum + mark.beats, 0);
}

function stationaryFrame(
  performer: LegacyPerformer,
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

export function samplePerformerPerformance(
  performer: LegacyPerformer,
  choreography: SamplingChoreography,
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

function arrivalBeats(performer: LegacyPerformer): number[] {
  const beats = [0];
  let arrivalBeat = 0;
  for (let index = 1; index < performer.marks.length; index += 1) {
    arrivalBeat += performer.marks[index]!.beats;
    beats.push(arrivalBeat);
  }
  return beats;
}

function activeMarkAtArrival(
  performer: LegacyPerformer,
  beat: number
): Mark | undefined {
  const first = performer.marks[0];
  if (!first || beat <= 0) return first;

  let arrivalBeat = 0;
  for (let index = 1; index < performer.marks.length; index += 1) {
    const mark = performer.marks[index]!;
    arrivalBeat += mark.beats;
    if (beat <= arrivalBeat) return mark;
  }
  return performer.marks.at(-1);
}

export function marksToFormations(
  performers: LegacyPerformer[],
  choreography: SamplingChoreography
): Formation[] {
  const formationBeats = [
    ...new Set(performers.flatMap((performer) => arrivalBeats(performer))),
  ].sort((a, b) => a - b);

  return formationBeats.map((atBeat, index) => {
    const previousBeat = formationBeats[index - 1] ?? atBeat;
    const spots: Formation["spots"] = {};

    for (const performer of performers) {
      const frame = samplePerformerPerformance(performer, choreography, atBeat);
      const activeMark = activeMarkAtArrival(performer, atBeat);
      spots[performer.id] = {
        x: frame.stagePosition.x,
        z: frame.stagePosition.z,
        facingAngle: frame.bodyFacing,
        walkStyle: activeMark?.walkStyle ?? "direct",
        easing: activeMark?.easing ?? "linear",
      };
    }

    return {
      id: `migrated-formation-${atBeat}`,
      atBeat,
      transitionBeats:
        index === 0 ? 0 : Math.min(atBeat - previousBeat, atBeat),
      spots,
    };
  });
}
