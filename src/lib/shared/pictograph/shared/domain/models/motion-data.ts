/**
 * Motion Data Domain Model
 *
 * Immutable motion data for props and arrows with embedded placement data.
 * Represents complete motion information including positioning and rendering data.
 *
 * @deprecated This type mixes engine-structural and view-layer concerns.
 * Migrate consumers to one of:
 *   - `Motion` from `@tka/tka-types` - engine/structural fields only
 *     (motionType, startLocation, endLocation, rotationDirection,
 *     startOrientation, endOrientation, turns, plane, color, prefloat fields)
 *   - `MotionView` from `./motion-view` - visual/runtime fields only
 *     (isVisible, propType, arrowLocation, gridMode, arrowPlacementData,
 *     propPlacementData, handPath, skewSteps, skewDir)
 *   - `MotionWithView` from `./motion-view` - composition for mixed consumers
 *
 * See docs/superpowers/specs/2026-04-20-sequence-engine-unification-design.md
 * (Phase 2a - Sequence Engine Unification).
 */

// IMPORTANT: Import directly from specific files to avoid circular dependencies
// DO NOT import from barrel exports (../../../arrow, ../../../prop) as they import MotionData
import { type ArrowPlacementData } from "../../../arrow/positioning/placement/domain/arrow-placement-data";
import type { Plane } from "@austencloud/scene-3d";
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

export interface MotionData {
  readonly motionType: MotionType;
  readonly rotationDirection: RotationDirection;
  readonly startLocation: GridLocation;
  readonly endLocation: GridLocation;
  readonly turns: number | "fl"; // Can be 'fl' for float motions
  readonly startOrientation: Orientation;
  readonly endOrientation: Orientation;
  readonly isVisible: boolean;
  readonly propType: PropType;
  readonly arrowLocation: GridLocation;
  readonly color: MotionColor;
  readonly gridMode: GridMode; // CRITICAL: Grid mode for correct positioning

  // EMBEDDED PLACEMENT DATA: Everything accessible through motion data
  readonly arrowPlacementData: ArrowPlacementData;
  readonly propPlacementData: PropPlacementData;

  // Prefloat attributes for letter determination
  readonly prefloatMotionType?: MotionType;
  readonly prefloatRotationDirection?: RotationDirection;

  // Hand path direction - essential for floats (no rotation to derive from),
  // explicitly stored for all motion types for self-documenting data
  readonly handPath?: HandPath | null;

  // Number of 45° steps the motion travels (0 = normal, 1+ = skewed)
  readonly skewSteps?: number | null;

  // Direction of skew: + goes further, - goes less far than normal
  // Only meaningful when skewSteps > 0
  readonly skewDir?: SkewDirection | null;

  // Which 3D plane this motion is performed on.
  // Absent/undefined = Plane.WALL (backward compatible).
  // Only used by the 3D viewer - 2D pictographs ignore this field.
  readonly plane?: Plane;

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
