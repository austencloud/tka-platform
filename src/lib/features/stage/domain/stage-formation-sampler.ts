import {
  applyStageEasing,
  easingDerivative,
  segmentFacing,
  stageToWorld,
  worldToBodyDirection,
} from "./stage-performance-sampler";
import type { StagePerformanceFrame } from "./stage-performance-sampler";
import type { FormationSpot, StageChoreography } from "./stage-types";

const MOVEMENT_EPSILON = 0.0001;

function spotAtOrBefore(
  choreography: StageChoreography,
  performerId: string,
  formationIndex: number
): FormationSpot | undefined {
  for (let index = formationIndex; index >= 0; index -= 1) {
    const spot = choreography.formations[index]?.spots[performerId];
    if (spot) return spot;
  }
  return undefined;
}

function centerSpot(choreography: StageChoreography): FormationSpot {
  return {
    x: choreography.stageWidth / 2,
    z: choreography.stageDepth / 2,
    walkStyle: "direct",
    easing: "linear",
  };
}

function arrivalFacing(
  choreography: StageChoreography,
  performerId: string,
  formationIndex: number,
  spot: FormationSpot
): number {
  if (formationIndex === 0) return spot.facingAngle ?? 0;

  const previous =
    spotAtOrBefore(choreography, performerId, formationIndex - 1) ?? spot;
  const worldFrom = stageToWorld(previous, choreography);
  const worldTo = stageToWorld(spot, choreography);
  return segmentFacing(
    previous,
    spot,
    worldTo.x - worldFrom.x,
    worldTo.z - worldFrom.z
  );
}

function stationaryFrame(
  choreography: StageChoreography,
  performerId: string,
  formationIndex: number,
  spot: FormationSpot
): StagePerformanceFrame {
  const stagePosition = { x: spot.x, z: spot.z };
  return {
    performerId,
    stagePosition,
    worldPosition: stageToWorld(stagePosition, choreography),
    bodyFacing: arrivalFacing(choreography, performerId, formationIndex, spot),
    travelDirection: { x: 0, z: 0 },
    moveDirection: { x: 0, z: 0 },
    speedMetersPerSecond: 0,
    isMoving: false,
    activeMarkIndex: formationIndex,
    transitionProgress: 1,
  };
}

export function sampleFormationPerformance(
  choreography: StageChoreography,
  performerId: string,
  beat: number
): StagePerformanceFrame {
  const first = choreography.formations[0];
  if (!first) {
    return stationaryFrame(
      choreography,
      performerId,
      0,
      centerSpot(choreography)
    );
  }

  const firstSpot = first.spots[performerId] ?? centerSpot(choreography);
  if (choreography.formations.length === 1 || beat <= 0) {
    return stationaryFrame(choreography, performerId, 0, firstSpot);
  }

  let activeIndex = 0;
  for (let index = 1; index < choreography.formations.length; index += 1) {
    if (choreography.formations[index]!.atBeat > beat) break;
    activeIndex = index;
  }

  const active = choreography.formations[activeIndex]!;
  const activeSpot =
    spotAtOrBefore(choreography, performerId, activeIndex) ?? firstSpot;
  const nextIndex = activeIndex + 1;
  const next = choreography.formations[nextIndex];
  if (!next || beat < next.atBeat - next.transitionBeats) {
    return stationaryFrame(choreography, performerId, activeIndex, activeSpot);
  }

  const to = next.spots[performerId] ?? activeSpot;
  const rawProgress =
    next.transitionBeats > 0
      ? Math.max(
          0,
          Math.min(
            1,
            (beat - (next.atBeat - next.transitionBeats)) / next.transitionBeats
          )
        )
      : 1;
  const transitionProgress = applyStageEasing(rawProgress, to.easing);
  const stagePosition = {
    x: activeSpot.x + (to.x - activeSpot.x) * transitionProgress,
    z: activeSpot.z + (to.z - activeSpot.z) * transitionProgress,
  };
  const worldFrom = stageToWorld(activeSpot, choreography);
  const worldTo = stageToWorld(to, choreography);
  const worldDx = worldTo.x - worldFrom.x;
  const worldDz = worldTo.z - worldFrom.z;
  const distance = Math.hypot(worldDx, worldDz);
  const travelDirection =
    distance > MOVEMENT_EPSILON
      ? { x: worldDx / distance, z: worldDz / distance }
      : { x: 0, z: 0 };
  const bodyFacing = segmentFacing(activeSpot, to, worldDx, worldDz);
  const durationSeconds =
    next.transitionBeats > 0
      ? (next.transitionBeats * 60) / choreography.bpm
      : 0;
  const averageSpeed = durationSeconds > 0 ? distance / durationSeconds : 0;
  const speedMetersPerSecond =
    averageSpeed * easingDerivative(rawProgress, to.easing);

  return {
    performerId,
    stagePosition,
    worldPosition: stageToWorld(stagePosition, choreography),
    bodyFacing,
    travelDirection,
    moveDirection: worldToBodyDirection(travelDirection, bodyFacing),
    speedMetersPerSecond,
    isMoving: speedMetersPerSecond > MOVEMENT_EPSILON,
    activeMarkIndex: nextIndex,
    transitionProgress,
  };
}

export function sampleStageFormations(
  choreography: StageChoreography,
  beat: number
): StagePerformanceFrame[] {
  return choreography.performers.map((performer) =>
    sampleFormationPerformance(choreography, performer.id, beat)
  );
}
