import type { Formation, FormationSpot } from "./stage-types";

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function defaultSpot(stageWidth: number, stageDepth: number): FormationSpot {
  return {
    x: stageWidth / 2,
    z: stageDepth / 2,
    walkStyle: "direct",
    easing: "linear",
  };
}

export function normalizeFormations(
  formations: Formation[],
  performerIds: string[],
  stageWidth: number,
  stageDepth: number
): Formation[] {
  const width = Math.max(0, finiteOr(stageWidth, 0));
  const depth = Math.max(0, finiteOr(stageDepth, 0));
  const source =
    formations.length > 0
      ? formations
      : [
          {
            id: "formation-0",
            atBeat: 0,
            transitionBeats: 0,
            spots: {},
          },
        ];

  const normalized = source
    .map((formation, sourceIndex) => {
      const spots: Formation["spots"] = {};
      for (const performerId of performerIds) {
        const spot = formation.spots[performerId] ?? defaultSpot(width, depth);
        spots[performerId] = {
          ...spot,
          x: clamp(finiteOr(spot.x, width / 2), 0, width),
          z: clamp(finiteOr(spot.z, depth / 2), 0, depth),
        };
      }

      return {
        formation: {
          ...formation,
          atBeat: Math.max(0, Math.round(finiteOr(formation.atBeat, 0))),
          transitionBeats: Math.max(
            0,
            Math.round(finiteOr(formation.transitionBeats, 0))
          ),
          spots,
        },
        sourceIndex,
      };
    })
    .sort(
      (a, b) =>
        a.formation.atBeat - b.formation.atBeat || a.sourceIndex - b.sourceIndex
    );

  if (normalized[0]) normalized[0].formation.atBeat = 0;

  const unique: Formation[] = [];
  for (const entry of normalized) {
    if (unique.at(-1)?.atBeat === entry.formation.atBeat) continue;
    unique.push(entry.formation);
  }

  return unique.map((formation, index) => {
    const previous = unique[index - 1];
    return {
      ...formation,
      transitionBeats:
        index === 0
          ? 0
          : clamp(
              formation.transitionBeats,
              0,
              formation.atBeat - (previous?.atBeat ?? 0)
            ),
    };
  });
}
