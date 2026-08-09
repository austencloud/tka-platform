import { AUTUMN_POND_LAYOUT } from "../water/autumn-pond-layout";

export interface AutumnFireflyCluster {
  id: "pond" | "east-ring" | "northwest-ring";
  position: [number, number];
  area: { width: number; height: number; depth: number };
  weight: number;
}

export interface AutumnLeafEmitter {
  id:
    | "west-canopy"
    | "east-canopy"
    | "rear-west-canopy"
    | "rear-center-canopy"
    | "rear-east-canopy"
    | "front-edge-canopy";
  position: [number, number];
  area: { width: number; height: number; depth: number };
  weight: number;
}

export const AUTUMN_FIREFLY_CLUSTERS: readonly AutumnFireflyCluster[] =
  Object.freeze([
    {
      id: "pond",
      position: [AUTUMN_POND_LAYOUT.centerX, AUTUMN_POND_LAYOUT.centerZ],
      area: { width: 7.5, height: 3.8, depth: 6 },
      weight: 0.42,
    },
    {
      id: "east-ring",
      position: [9, -1],
      area: { width: 6.2, height: 3.2, depth: 5.4 },
      weight: 0.33,
    },
    {
      id: "northwest-ring",
      position: [-4.8, -10.8],
      area: { width: 5.5, height: 3, depth: 5.5 },
      weight: 0.25,
    },
  ]);

export const AUTUMN_LEAF_EMITTERS: readonly AutumnLeafEmitter[] = Object.freeze(
  [
    {
      id: "west-canopy",
      position: [-12.8, -6.5],
      area: { width: 8.5, height: 9, depth: 7 },
      weight: 0.2,
    },
    {
      id: "east-canopy",
      position: [13.6, -8.5],
      area: { width: 8.5, height: 9, depth: 7 },
      weight: 0.19,
    },
    {
      id: "rear-west-canopy",
      position: [-10.4, -16.8],
      area: { width: 8, height: 8.5, depth: 6.5 },
      weight: 0.16,
    },
    {
      id: "rear-center-canopy",
      position: [6.2, -18.3],
      area: { width: 8.5, height: 10, depth: 6.5 },
      weight: 0.18,
    },
    {
      id: "rear-east-canopy",
      position: [18.8, -13],
      area: { width: 7, height: 8, depth: 6 },
      weight: 0.14,
    },
    {
      id: "front-edge-canopy",
      position: [-18.2, 9.2],
      area: { width: 7, height: 7.5, depth: 6 },
      weight: 0.13,
    },
  ]
);

function allocateWeighted(total: number, weights: readonly number[]): number[] {
  // With no weights the distribution loop below indexes by `i % 0`, which is
  // NaN, and the function returns garbage rather than failing. An empty
  // allocation is simply an empty result.
  if (weights.length === 0) return [];
  const wholeTotal = Math.max(0, Math.floor(total));
  const counts = weights.map((weight) => Math.floor(wholeTotal * weight));
  let assigned = counts.reduce((sum, count) => sum + count, 0);
  for (let i = 0; assigned < wholeTotal; i = (i + 1) % counts.length) {
    counts[i]! += 1;
    assigned += 1;
  }
  return counts;
}

export function allocateAutumnFireflies(total: number): number[] {
  return allocateWeighted(
    total,
    AUTUMN_FIREFLY_CLUSTERS.map((cluster) => cluster.weight)
  );
}

export function allocateAutumnCanopyLeaves(total: number): number[] {
  return allocateWeighted(
    total,
    AUTUMN_LEAF_EMITTERS.map((emitter) => emitter.weight)
  );
}
