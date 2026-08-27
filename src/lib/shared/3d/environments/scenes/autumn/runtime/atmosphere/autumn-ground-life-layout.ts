import { AUTUMN_POND_LAYOUT } from "../water/autumn-pond-layout";

export interface AutumnFireflyCluster {
  id: "pond" | "deadwood" | "champignon-arc";
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
  fallSpeed: number;
  colors: readonly [string, string, string, string];
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
      id: "deadwood",
      position: [10.35, -6.75],
      area: { width: 4.2, height: 3.2, depth: 3.4 },
      weight: 0.33,
    },
    {
      id: "champignon-arc",
      position: [4, -12],
      area: { width: 5.5, height: 3, depth: 4.8 },
      weight: 0.25,
    },
  ]);

export const AUTUMN_LEAF_EMITTERS: readonly AutumnLeafEmitter[] = Object.freeze(
  [
    {
      id: "west-canopy",
      position: [-12.8, -6.5],
      area: { width: 7.6, height: 9.6, depth: 6.2 },
      weight: 0.2,
      fallSpeed: 0.098,
      colors: ["#a84a18", "#c47324", "#7d2a14", "#cf9038"],
    },
    {
      id: "east-canopy",
      position: [14.9, -9.6],
      area: { width: 7.2, height: 8.2, depth: 6.0 },
      weight: 0.19,
      fallSpeed: 0.112,
      colors: ["#c47324", "#cf9038", "#8f3517", "#d9a044"],
    },
    {
      id: "rear-west-canopy",
      position: [-10.4, -16.8],
      area: { width: 6.8, height: 7.8, depth: 5.8 },
      weight: 0.16,
      fallSpeed: 0.088,
      colors: ["#762710", "#9f3d16", "#ba5b1d", "#d0852d"],
    },
    {
      id: "rear-center-canopy",
      position: [6.2, -18.3],
      area: { width: 8.5, height: 10, depth: 6.5 },
      weight: 0.18,
      fallSpeed: 0.104,
      colors: ["#aa3f15", "#c4601d", "#81270f", "#d18a31"],
    },
    {
      id: "rear-east-canopy",
      position: [20.4, -14.6],
      area: { width: 7.8, height: 9.0, depth: 6.2 },
      weight: 0.14,
      fallSpeed: 0.118,
      colors: ["#bd571a", "#d18427", "#8d3213", "#d7a13c"],
    },
    {
      id: "front-edge-canopy",
      position: [-18.2, 9.2],
      area: { width: 7.2, height: 8.4, depth: 6 },
      weight: 0.13,
      fallSpeed: 0.092,
      colors: ["#70240f", "#963313", "#b95018", "#c87b27"],
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
