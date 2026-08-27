/**
 * Prop orientation states.
 *
 * Four families, all grounded in packages/sequence-engine/src/core/types/sequence-engine-types.ts:
 *   - Radial (L1 / L2 base): `in`, `out`
 *   - Nonradial (L3): `clock`, `counter`
 *   - Interradial (L4 — 45 degrees between cardinal orientations):
 *       `clockIn`, `clockOut`, `counterIn`, `counterOut`
 *   - Centric (L6 — prop at the center point, facing a compass heading):
 *       `centerN`, `centerNE`, `centerE`, `centerSE`,
 *       `centerS`, `centerSW`, `centerW`, `centerNW`
 */
export const Orientation = {
  in: "in",
  out: "out",
  clock: "clock",
  counter: "counter",
  clockIn: "clockIn",
  clockOut: "clockOut",
  counterIn: "counterIn",
  counterOut: "counterOut",
  centerN: "centerN",
  centerNE: "centerNE",
  centerE: "centerE",
  centerSE: "centerSE",
  centerS: "centerS",
  centerSW: "centerSW",
  centerW: "centerW",
  centerNW: "centerNW",
} as const;

export type Orientation = (typeof Orientation)[keyof typeof Orientation];

export const ORIENTATIONS: readonly Orientation[] = Object.freeze(
  Object.values(Orientation)
);
