export interface ForestFireflyField {
  id: string;
  position: readonly [number, number, number];
  area: Readonly<{ width: number; height: number; depth: number }>;
  countScale: number;
  habitat: string;
}

/**
 * Authored firefly habitats for the default Forest composition.
 *
 * Counts scale from the production scene setting, while positions remain tied
 * to damp edges, meadow shade, and the trail instead of forming one stage halo.
 */
export const FOREST_FIREFLY_FIELDS: readonly ForestFireflyField[] = [
  {
    id: "clearing-edge",
    position: [0, 1.35, 3],
    area: { width: 12, height: 2.6, depth: 9 },
    countScale: 0.45,
    habitat: "Low grass along the audience edge of the clearing",
  },
  {
    id: "west-root-shelf",
    position: [-15, 1.8, -7],
    area: { width: 13, height: 3.2, depth: 12 },
    countScale: 0.36,
    habitat: "Damp deadwood and mushrooms below the west beech",
  },
  {
    id: "east-runoff-bank",
    position: [17, 1.65, -8],
    area: { width: 12, height: 3, depth: 11 },
    countScale: 0.32,
    habitat: "Mossy runoff around the east boulder and elm",
  },
  {
    id: "trail-shoulders",
    position: [-7, 1.75, -25],
    area: { width: 15, height: 3.4, depth: 22 },
    countScale: 0.38,
    habitat: "Uneven damp shoulders along the path into the trees",
  },
  {
    id: "deep-woodland",
    position: [8, 3.6, -48],
    area: { width: 24, height: 5.5, depth: 24 },
    countScale: 0.25,
    habitat: "Sparse depth lights beyond the visible trail bend",
  },
  {
    id: "damp-hollow",
    position: [16.5, 1.55, 24],
    area: { width: 17, height: 2.8, depth: 9.6 },
    countScale: 0.28,
    habitat: "Sedge and amanitas in the low downstage-right wet pocket",
  },
] as const;
