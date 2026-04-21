/**
 * Builder / factory helpers for Motion and Step.
 *
 * Every builder:
 *   - Runtime-validates enum membership on every typed field.
 *   - Throws TypeError / RangeError with a descriptive message on invalid input.
 *   - Returns a deep-frozen object so downstream code can rely on immutability
 *     without defensive copies.
 *
 * `updateStep` and `updateMotion` produce a new frozen object with a shallow
 * merge applied; the original is untouched.
 */

import type { Motion, StepMotions, Step } from "./index.js";
import { MotionType } from "./motion-type.js";
import { RotationDirection } from "./rotation-direction.js";
import { Orientation } from "./orientation.js";
import { GridLocation, GridMode, GridPosition } from "./grid.js";
import { Plane } from "./plane.js";
import { PropColor } from "./prop-color.js";

// Reusable enum-value lookups for fast runtime validation.
const MOTION_TYPE_VALUES = new Set<string>(Object.values(MotionType));
const ROTATION_DIRECTION_VALUES = new Set<string>(Object.values(RotationDirection));
const ORIENTATION_VALUES = new Set<string>(Object.values(Orientation));
const GRID_LOCATION_VALUES = new Set<string>(Object.values(GridLocation));
const GRID_MODE_VALUES = new Set<string>(Object.values(GridMode));
const GRID_POSITION_VALUES = new Set<string>(Object.values(GridPosition));
const PLANE_VALUES = new Set<string>(Object.values(Plane));
const PROP_COLOR_VALUES = new Set<string>(Object.values(PropColor));

function assertMember(
  value: unknown,
  allowed: Set<string>,
  label: string
): void {
  if (typeof value !== "string" || !allowed.has(value)) {
    throw new TypeError(
      `Invalid ${label}: ${JSON.stringify(value)} is not a recognized enum value`
    );
  }
}

function assertOptionalMember(
  value: unknown,
  allowed: Set<string>,
  label: string
): void {
  if (value === undefined) return;
  assertMember(value, allowed, label);
}

function assertTurns(value: unknown): void {
  if (value === "fl") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  throw new TypeError(
    `Invalid turns: ${JSON.stringify(value)} — expected finite number or "fl"`
  );
}

/**
 * Build a Motion. Validates every enum field, freezes the result.
 *
 * Defaults:
 *   - `plane` defaults to `Plane.wall` when not supplied.
 *
 * Optional:
 *   - `color` may be omitted; a Motion stored under `step.motions.blue` is
 *     definitionally blue (and same for red), so color is redundant there.
 *
 * Throws TypeError on invalid enum membership, on missing required fields,
 * or on invalid `turns` values.
 */
export function createMotion(input: Omit<Motion, "plane"> & { plane?: Plane }): Motion {
  assertMember(input.motionType, MOTION_TYPE_VALUES, "motionType");
  assertMember(input.startLocation, GRID_LOCATION_VALUES, "startLocation");
  assertMember(input.endLocation, GRID_LOCATION_VALUES, "endLocation");
  assertMember(
    input.rotationDirection,
    ROTATION_DIRECTION_VALUES,
    "rotationDirection"
  );
  assertMember(input.startOrientation, ORIENTATION_VALUES, "startOrientation");
  assertMember(input.endOrientation, ORIENTATION_VALUES, "endOrientation");
  assertTurns(input.turns);
  const plane: Plane = input.plane ?? Plane.wall;
  assertMember(plane, PLANE_VALUES, "plane");
  assertOptionalMember(input.color, PROP_COLOR_VALUES, "color");
  assertOptionalMember(
    input.prefloatMotionType,
    MOTION_TYPE_VALUES,
    "prefloatMotionType"
  );
  assertOptionalMember(
    input.prefloatRotationDirection,
    ROTATION_DIRECTION_VALUES,
    "prefloatRotationDirection"
  );

  const frozen: Motion = {
    motionType: input.motionType,
    startLocation: input.startLocation,
    endLocation: input.endLocation,
    rotationDirection: input.rotationDirection,
    startOrientation: input.startOrientation,
    endOrientation: input.endOrientation,
    turns: input.turns,
    plane,
    ...(input.color !== undefined && { color: input.color }),
    ...(input.prefloatMotionType !== undefined && {
      prefloatMotionType: input.prefloatMotionType,
    }),
    ...(input.prefloatRotationDirection !== undefined && {
      prefloatRotationDirection: input.prefloatRotationDirection,
    }),
  };
  return Object.freeze(frozen);
}

/**
 * Return a new frozen Motion with `changes` shallow-merged over `base`.
 */
export function updateMotion(base: Motion, changes: Partial<Motion>): Motion {
  return createMotion({ ...base, ...changes });
}

function freezeStepMotions(blue: Motion, red: Motion): StepMotions {
  if (!Object.isFrozen(blue) || !Object.isFrozen(red)) {
    throw new TypeError(
      "Step.motions.blue and Step.motions.red must be produced via createMotion (frozen)"
    );
  }
  // `color` is optional on Motion. When present it must match the channel;
  // when absent, the channel itself ("blue"/"red") is definitional.
  if (blue.color !== undefined && blue.color !== "blue") {
    throw new TypeError(
      `Step.motions.blue.color must be "blue" or undefined, got ${JSON.stringify(blue.color)}`
    );
  }
  if (red.color !== undefined && red.color !== "red") {
    throw new TypeError(
      `Step.motions.red.color must be "red" or undefined, got ${JSON.stringify(red.color)}`
    );
  }
  return Object.freeze({ blue, red });
}

function validateStepScalars(input: Step): void {
  if (typeof input.id !== "string" || input.id.length === 0) {
    throw new TypeError("Step.id must be a non-empty string");
  }
  if (!Number.isInteger(input.stepNumber) || input.stepNumber < 0) {
    throw new RangeError(
      `Step.stepNumber must be a non-negative integer, got ${input.stepNumber}`
    );
  }
  if (!Number.isFinite(input.duration) || input.duration <= 0) {
    throw new RangeError(
      `Step.duration must be a positive finite number, got ${input.duration}`
    );
  }
  if (input.startPosition !== null) {
    assertMember(input.startPosition, GRID_POSITION_VALUES, "startPosition");
  }
  if (input.endPosition !== null) {
    assertMember(input.endPosition, GRID_POSITION_VALUES, "endPosition");
  }
  assertOptionalMember(input.gridMode, GRID_MODE_VALUES, "gridMode");
  if (input.variation !== undefined) {
    if (!Number.isInteger(input.variation) || input.variation < 0) {
      throw new RangeError(
        `Step.variation must be a non-negative integer, got ${input.variation}`
      );
    }
  }
}

/**
 * Generate a stable-ish id when caller does not supply one.
 * Prefers `crypto.randomUUID` when available; falls back to a time-seeded
 * random string. The returned id is a non-empty string.
 */
function generateStepId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto && typeof g.crypto.randomUUID === "function") {
    return g.crypto.randomUUID();
  }
  return `step-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Input for `createStep`.
 *
 * `id` and `duration` are type-level optional — the builder supplies defaults
 * (uuid and `1` respectively) when omitted. All other required `Step` fields
 * are required here as well. The returned `Step` is fully populated and frozen.
 */
export type CreateStepInput = Omit<Step, "id" | "duration"> & {
  readonly id?: string;
  readonly duration?: number;
};

/**
 * Build a Step with all invariants enforced.
 *
 * Defaults supplied when omitted:
 *   - `id`: `crypto.randomUUID()` (or a time-seeded fallback).
 *   - `duration`: `1` (one musical beat).
 *
 * Rebuilds an immutable copy (freezing both the outer object and the motions
 * record).
 */
export function createStep(input: CreateStepInput): Step {
  const populated: Step = {
    ...input,
    id: input.id && input.id.length > 0 ? input.id : generateStepId(),
    duration: input.duration ?? 1,
  };
  validateStepScalars(populated);
  const motions = freezeStepMotions(populated.motions.blue, populated.motions.red);
  const frozen: Step = {
    id: populated.id,
    letter: populated.letter,
    startPosition: populated.startPosition,
    endPosition: populated.endPosition,
    motions,
    stepNumber: populated.stepNumber,
    duration: populated.duration,
    ...(populated.gridMode !== undefined && { gridMode: populated.gridMode }),
    ...(populated.variation !== undefined && { variation: populated.variation }),
    ...(populated.isBridge !== undefined && { isBridge: populated.isBridge }),
    ...(populated.isBlank !== undefined && { isBlank: populated.isBlank }),
  };
  return Object.freeze(frozen);
}

/**
 * Build a start-position Step (stepNumber 0) for a given grid position.
 *
 * Both hands hold static motions at the center point with radial orientation.
 * `letter` is null (start position has no letter).
 */
export function createStartStep(pos: GridPosition): Step {
  const staticBlue = createMotion({
    motionType: MotionType.static,
    startLocation: GridLocation.n,
    endLocation: GridLocation.n,
    rotationDirection: RotationDirection.noRotation,
    startOrientation: Orientation.in,
    endOrientation: Orientation.in,
    turns: 0,
    plane: Plane.wall,
    color: PropColor.blue,
  });
  const staticRed = createMotion({
    motionType: MotionType.static,
    startLocation: GridLocation.n,
    endLocation: GridLocation.n,
    rotationDirection: RotationDirection.noRotation,
    startOrientation: Orientation.in,
    endOrientation: Orientation.in,
    turns: 0,
    plane: Plane.wall,
    color: PropColor.red,
  });
  return createStep({
    id: `step-0-${pos}`,
    letter: null,
    startPosition: pos,
    endPosition: pos,
    motions: { blue: staticBlue, red: staticRed },
    stepNumber: 0,
    duration: 1,
  });
}

/**
 * Return a new frozen Step with `changes` shallow-merged over `base`.
 * Validations re-run on the merged object.
 */
export function updateStep(base: Step, changes: Partial<Step>): Step {
  const merged: Step = { ...base, ...changes };
  // If motions changed, route through createStep's freezing path.
  if (changes.motions) {
    return createStep(merged);
  }
  return createStep(merged);
}
