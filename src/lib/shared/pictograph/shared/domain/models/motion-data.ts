/**
 * Motion Data Domain Model
 *
 * The app's working motion type: a canonical `@tka/tka-types` `Motion`
 * composed with REQUIRED view-layer fields (visibility, prop type, computed
 * arrow location, grid mode, placement data) plus the optional authored view
 * fields (handPath, skew, pathShape).
 *
 * Since 2026-07-02 this extends the canonical `Motion` directly, so every
 * `MotionData` IS a `Motion` (and a `MotionWithView`) by declaration — no
 * bridge needed. The view fields stay required here because rendering needs
 * them; `MotionView`/`MotionWithView` (./motion-view) model the same fields
 * as optional for consumers that accept lean engine output.
 *
 * The only narrowed fields are `motionType`/`prefloatMotionType` (the app
 * union omits the canonical "shift" generalization) and `color` (required
 * app-side).
 */

// IMPORTANT: Import directly from specific files to avoid circular dependencies
// DO NOT import from barrel exports (../../../arrow, ../../../prop) as they import MotionData
import type { Motion } from "@tka/tka-types";
import { type ArrowPlacementData } from "../../../arrow/positioning/placement/domain/arrow-placement-data";
import { createArrowPlacementData } from "../../../arrow/positioning/placement/domain/create-arrow-placement-data";
import { GridLocation, GridMode } from "../../../grid/domain/enums/grid-enums";
import { type PropPlacementData } from "../../../prop/domain/models/prop-placement-data";
import { createPropPlacementData } from "../../../prop/domain/factories/create-prop-placement-data";
import { PropType } from "../../../prop/domain/enums/prop-type";
import type {
  HandPath,
  SkewDirection} from "../enums/pictograph-enums";
import {
  MotionColor,
  MotionType,
  RotationDirection,
  Orientation
} from "../enums/pictograph-enums";

export interface MotionData extends Motion {
  // App narrowing of the canonical superset (no "shift" in app data).
  readonly motionType: MotionType;
  readonly prefloatMotionType?: MotionType;

  readonly isVisible: boolean;
  readonly propType: PropType;
  readonly arrowLocation: GridLocation;
  readonly color: MotionColor;
  readonly gridMode: GridMode; // CRITICAL: Grid mode for correct positioning

  // EMBEDDED PLACEMENT DATA: Everything accessible through motion data
  readonly arrowPlacementData: ArrowPlacementData;
  readonly propPlacementData: PropPlacementData;

  // Hand path direction - essential for floats (no rotation to derive from),
  // explicitly stored for all motion types for self-documenting data
  readonly handPath?: HandPath | null;

  // Number of 45° steps the motion travels (0 = normal, 1+ = skewed)
  readonly skewSteps?: number | null;

  // Direction of skew: + goes further, - goes less far than normal
  // Only meaningful when skewSteps > 0
  readonly skewDir?: SkewDirection | null;

  // Per-step path shape override for animation interpolation.
  // Absent/undefined = use global pathShape setting.
  readonly pathShape?: "arc" | "linear" | "concave";
}

/**
 * Runtime/rendered form of MotionData - extends domain data with viewer concerns.
 *
 * StepDeriver produces DerivedMotionData by injecting propType, color, and
 * isVisible from the resolved presentation. All rendering consumers should
 * type their inputs as DerivedMotionData.
 *
 * The base MotionData is the persisted/domain form without viewer concerns.
 */
export interface DerivedMotionData extends MotionData {
  readonly propType: PropType;
  readonly color: MotionColor;
  readonly isVisible: boolean;
}

/**
 * Factory function to create MotionData with sensible defaults
 *
 * IMPORTANT: PropType is a VIEWER PREFERENCE, not sequence data
 * - motion.propType is stored but ALWAYS overridden by global settings during render
 * - Exception: PropType.HAND (Assembly mode) is never overridden
 * - All pictographs in a sequence MUST use the same global prop settings
 * - Blue vs red CAN differ (catDogMode), but all blues must match, all reds must match
 * - When global prop settings change, ALL pictographs re-render with new props
 */
export function createMotionData(data: Partial<MotionData> = {}): MotionData {
  return {
    motionType: data.motionType ?? MotionType.STATIC,
    rotationDirection: data.rotationDirection ?? RotationDirection.NO_ROTATION,
    startLocation: data.startLocation ?? GridLocation.NORTH,
    endLocation: data.endLocation ?? GridLocation.NORTH,
    turns: data.turns ?? 0.0,
    startOrientation: data.startOrientation ?? Orientation.IN,
    endOrientation: data.endOrientation ?? Orientation.IN,
    isVisible: data.isVisible ?? true,
    propType: data.propType ?? PropType.STAFF, // Default - services should override with settings.propType for new motions
    arrowLocation: data.arrowLocation ?? GridLocation.NORTH, // Must be calculated by ArrowLocationCalculator - NEVER default to startLocation!
    color: data.color ?? MotionColor.BLUE, // Single source of truth for color
    // Normalize to the lowercase canonical enum — serialized/static data (e.g. guide
    // _data JSON) can carry uppercase "DIAMOND"/"BOX", which 404s the placement file fetch.
    gridMode: (data.gridMode
      ? (data.gridMode.toLowerCase() as GridMode)
      : GridMode.DIAMOND),

    arrowPlacementData: data.arrowPlacementData ?? createArrowPlacementData(),
    propPlacementData: data.propPlacementData ?? createPropPlacementData(),

    prefloatMotionType: data.prefloatMotionType ?? undefined,
    prefloatRotationDirection: data.prefloatRotationDirection ?? undefined,

    handPath: data.handPath ?? null,
    skewSteps: data.skewSteps ?? null,
    skewDir: data.skewDir ?? null,
    plane: data.plane ?? undefined,
    pathShape: data.pathShape ?? undefined,
  };
}

/**
 * A hand that is "not really there" — the single absence encoding for the
 * both-required step layer (see docs/superpowers/specs/active/
 * 2026-07-02-stepdata-step-absence-encoding-design.md).
 *
 * A static, non-rotating motion at the hand's last known location/orientation
 * (hard default NORTH/IN — same recipe as the sequence-decomposer placeholder),
 * marked `isVisible: false` so renderers, the animation engine, and derivation
 * gates skip it exactly where they used to skip an absent motion.
 */
/**
 * True when the hand is really there: present AND not an invisible
 * placeholder / stripped hand. The presence-as-signal sites that used to
 * branch on `if (motion)` branch on this after the both-required flip.
 */
export function isVisibleMotion<M extends { readonly isVisible?: boolean }>(
  m: M | null | undefined
): m is M {
  return !!m && m.isVisible !== false;
}

export function createPlaceholderMotion(
  color: MotionColor,
  opts: { location?: GridLocation; orientation?: Orientation } = {}
): MotionData {
  const location = opts.location ?? GridLocation.NORTH;
  const orientation = opts.orientation ?? Orientation.IN;
  return createMotionData({
    color,
    motionType: MotionType.STATIC,
    rotationDirection: RotationDirection.NO_ROTATION,
    startLocation: location,
    endLocation: location,
    startOrientation: orientation,
    endOrientation: orientation,
    turns: 0,
    isVisible: false,
  });
}
