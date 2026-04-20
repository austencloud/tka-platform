/**
 * Runtime type guards for Step and Motion.
 *
 * Plain boolean predicates (no Zod). Validate enum membership and required
 * fields, used when accepting untrusted input (Firestore reads, imported
 * JSON, MCP payloads, etc).
 *
 * These guards are intentionally conservative: they return `false` for any
 * value that deviates from the canonical shape, even if technically
 * coercible. Coercion belongs in the loader, not the guard.
 */

import type { Step, Motion } from "./index.js";
import { MotionType } from "./motion-type.js";
import { RotationDirection } from "./rotation-direction.js";
import { Orientation } from "./orientation.js";
import { GridLocation, GridMode, GridPosition } from "./grid.js";
import { Plane } from "./plane.js";
import { PropColor } from "./prop-color.js";

const MOTION_TYPE_VALUES = new Set<string>(Object.values(MotionType));
const ROTATION_DIRECTION_VALUES = new Set<string>(
  Object.values(RotationDirection)
);
const ORIENTATION_VALUES = new Set<string>(Object.values(Orientation));
const GRID_LOCATION_VALUES = new Set<string>(Object.values(GridLocation));
const GRID_MODE_VALUES = new Set<string>(Object.values(GridMode));
const GRID_POSITION_VALUES = new Set<string>(Object.values(GridPosition));
const PLANE_VALUES = new Set<string>(Object.values(Plane));
const PROP_COLOR_VALUES = new Set<string>(Object.values(PropColor));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEnumMember(value: unknown, allowed: Set<string>): boolean {
  return typeof value === "string" && allowed.has(value);
}

function isOptionalEnumMember(value: unknown, allowed: Set<string>): boolean {
  return value === undefined || isEnumMember(value, allowed);
}

function isTurns(value: unknown): boolean {
  if (value === "fl") return true;
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * True iff `value` is a fully-formed Motion object with all required enum
 * fields matching canonical membership.
 */
export function isMotion(value: unknown): value is Motion {
  if (!isRecord(value)) return false;
  if (!isEnumMember(value.motionType, MOTION_TYPE_VALUES)) return false;
  if (!isEnumMember(value.startLocation, GRID_LOCATION_VALUES)) return false;
  if (!isEnumMember(value.endLocation, GRID_LOCATION_VALUES)) return false;
  if (!isEnumMember(value.rotationDirection, ROTATION_DIRECTION_VALUES))
    return false;
  if (!isEnumMember(value.startOrientation, ORIENTATION_VALUES)) return false;
  if (!isEnumMember(value.endOrientation, ORIENTATION_VALUES)) return false;
  if (!isTurns(value.turns)) return false;
  if (!isEnumMember(value.plane, PLANE_VALUES)) return false;
  if (!isEnumMember(value.color, PROP_COLOR_VALUES)) return false;
  if (!isOptionalEnumMember(value.prefloatMotionType, MOTION_TYPE_VALUES))
    return false;
  if (
    !isOptionalEnumMember(
      value.prefloatRotationDirection,
      ROTATION_DIRECTION_VALUES
    )
  )
    return false;
  return true;
}

/**
 * True iff `value` is a fully-formed Step object. Recursively validates
 * `value.motions.blue` and `value.motions.red` via isMotion, including the
 * color-channel invariant (blue.color === "blue", red.color === "red").
 */
export function isStep(value: unknown): value is Step {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "string" || value.id.length === 0) return false;
  if (value.letter !== null) {
    // Letter values are strings; we don't exhaustively enumerate here because
    // compound and custom letters may extend the alphabet downstream. Any
    // non-empty string or null passes.
    if (typeof value.letter !== "string" || value.letter.length === 0)
      return false;
  }
  if (
    value.startPosition !== null &&
    !isEnumMember(value.startPosition, GRID_POSITION_VALUES)
  ) {
    return false;
  }
  if (
    value.endPosition !== null &&
    !isEnumMember(value.endPosition, GRID_POSITION_VALUES)
  ) {
    return false;
  }
  if (!isOptionalEnumMember(value.gridMode, GRID_MODE_VALUES)) return false;
  if (!Number.isInteger(value.stepNumber) || (value.stepNumber as number) < 0) {
    return false;
  }
  if (
    typeof value.duration !== "number" ||
    !Number.isFinite(value.duration) ||
    value.duration <= 0
  ) {
    return false;
  }
  if (value.variation !== undefined) {
    if (!Number.isInteger(value.variation) || (value.variation as number) < 0)
      return false;
  }
  if (value.isBridge !== undefined && typeof value.isBridge !== "boolean")
    return false;
  if (value.isBlank !== undefined && typeof value.isBlank !== "boolean")
    return false;

  if (!isRecord(value.motions)) return false;
  const motions = value.motions as Record<string, unknown>;
  if (!isMotion(motions.blue)) return false;
  if (!isMotion(motions.red)) return false;
  if ((motions.blue as Motion).color !== "blue") return false;
  if ((motions.red as Motion).color !== "red") return false;
  return true;
}
