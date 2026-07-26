/**
 * Orientation calculator — delegating shim over @tka/render-core.
 *
 * The end-orientation math lives in `@tka/render-core`
 * (`src/calculations/orientation.ts`) and is the single source of truth.
 *
 * This module used to carry a ~300-line copy of that math. The copy normalized
 * its input with a blanket `.toLowerCase()`, but the rotation cycles are keyed
 * camelCase — so every interradial (`clockIn`) and centric (`centerN`)
 * orientation missed every lookup. Two things went wrong at once: the turn
 * silently no-opped (a half turn from `centerN` returned `centerN` instead of
 * advancing the compass cycle), and an invalid token (`centern`) escaped into
 * downstream consumers, where it also missed the camelCase-keyed rotation maps.
 * Radial orientations (in/out/clock/counter) were unaffected, which is why it
 * went unnoticed.
 *
 * Delegating removes that entire failure class instead of re-fixing it here.
 * Do not reintroduce local orientation math in this file.
 */

import {
  calculateEndOrientation as coreCalculateEndOrientation,
  calculateOrientations as coreCalculateOrientations,
  type Orientation as CoreOrientation,
  type OrientationInput as CoreOrientationInput,
} from "@tka/render-core";

/** The 16 canonical orientations, re-exported from the single source of truth. */
export type Orientation = CoreOrientation;

/**
 * Value access for the canonical orientations. Previously a `string` enum;
 * kept as a const object so both `Orientation.IN` (value) and `Orientation`
 * (type) keep working, while staying assignable to render-core's union.
 */
export const Orientation = {
  // Radial
  IN: "in",
  OUT: "out",
  // Non-radial
  CLOCK: "clock",
  COUNTER: "counter",
  // Centric — prop at center, pointing toward a compass direction
  CENTER_N: "centerN",
  CENTER_NE: "centerNE",
  CENTER_E: "centerE",
  CENTER_SE: "centerSE",
  CENTER_S: "centerS",
  CENTER_SW: "centerSW",
  CENTER_W: "centerW",
  CENTER_NW: "centerNW",
  // Interradial — 45 degrees between the radial orientations
  CLOCK_IN: "clockIn",
  CLOCK_OUT: "clockOut",
  COUNTER_IN: "counterIn",
  COUNTER_OUT: "counterOut",
} as const satisfies Record<string, Orientation>;

export type OrientationInput = CoreOrientationInput;

/**
 * Calculate the end orientation for a motion.
 * Delegates to render-core, which canonicalizes the start orientation before
 * applying turn math.
 */
export function calculateEndOrientation(input: OrientationInput): Orientation {
  return coreCalculateEndOrientation(input);
}

/**
 * Calculate both start and end orientations for a motion.
 * Start orientation defaults to "in" (the universal starting orientation).
 */
export function calculateOrientations(input: OrientationInput): {
  startOrientation: Orientation;
  endOrientation: Orientation;
} {
  return coreCalculateOrientations(input);
}
