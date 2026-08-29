import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

import { sampleFormationPerformance } from "./stage-formation-sampler";
import type { StageChoreography } from "./stage-types";

export interface StageFloorTravelSegment {
  id: string;
  setIndex: number;
  label: string;
  startBeat: number;
  endBeat: number;
  distanceMeters: number;
}

export interface StageFloorSpeedSample {
  beat: number;
  metersPerSecond: number;
}

export function stageSequenceDisplayName(sequence: SequenceData): string {
  return (
    sequence.displayName?.trim() ||
    sequence.intendedWord?.trim() ||
    sequence.word?.trim() ||
    sequence.name?.trim() ||
    "Sequence"
  );
}

function spotAtOrBefore(
  choreography: StageChoreography,
  performerId: string,
  formationIndex: number
) {
  for (let index = formationIndex; index >= 0; index -= 1) {
    const spot = choreography.formations[index]?.spots[performerId];
    if (spot) return spot;
  }
  return undefined;
}

export function projectPerformerFloorTravel(
  choreography: StageChoreography,
  performerId: string
): StageFloorTravelSegment[] {
  return choreography.formations.slice(1).flatMap((formation, offset) => {
    const setIndex = offset + 1;
    const from = spotAtOrBefore(choreography, performerId, setIndex - 1);
    const to = formation.spots[performerId] ?? from;
    if (!from || !to) return [];

    return [
      {
        id: formation.id,
        setIndex,
        label: formation.label?.trim() || `Set ${setIndex + 1}`,
        startBeat: Math.max(0, formation.atBeat - formation.transitionBeats),
        endBeat: formation.atBeat,
        distanceMeters: Math.hypot(to.x - from.x, to.z - from.z),
      },
    ];
  });
}

export function samplePerformerFloorSpeed(
  choreography: StageChoreography,
  performerId: string,
  endBeat: number,
  samplesPerBeat = 4
): StageFloorSpeedSample[] {
  const safeEndBeat = Math.max(0, endBeat);
  const safeSamplesPerBeat = Math.max(1, Math.floor(samplesPerBeat));
  const sampleCount = Math.ceil(safeEndBeat * safeSamplesPerBeat);

  return Array.from({ length: sampleCount + 1 }, (_, index) => {
    const beat = Math.min(safeEndBeat, index / safeSamplesPerBeat);
    return {
      beat,
      metersPerSecond: sampleFormationPerformance(
        choreography,
        performerId,
        beat
      ).speedMetersPerSecond,
    };
  });
}

export function floorSpeedPath(
  samples: readonly StageFloorSpeedSample[],
  endBeat: number,
  maxMetersPerSecond: number,
  height = 100
): string {
  if (samples.length === 0 || endBeat <= 0) return "";
  const safeMax = Math.max(0.001, maxMetersPerSecond);

  return samples
    .map((sample, index) => {
      const y = Math.max(
        0,
        Math.min(height, height - (sample.metersPerSecond / safeMax) * height)
      );
      return `${index === 0 ? "M" : "L"} ${sample.beat.toFixed(3)} ${y.toFixed(3)}`;
    })
    .join(" ");
}
