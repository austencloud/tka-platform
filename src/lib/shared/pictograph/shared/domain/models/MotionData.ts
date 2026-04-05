/**
 * Motion Data Domain Model
 *
 * Immutable motion data for props and arrows with embedded placement data.
 * Represents complete motion information including positioning and rendering data.
 */

// IMPORTANT: Import directly from specific files to avoid circular dependencies
// DO NOT import from barrel exports (../../../arrow, ../../../prop) as they import MotionData
import { type ArrowPlacementData } from "../../../arrow/positioning/placement/domain/ArrowPlacementData";
import { Plane } from "$lib/shared/3d/domain/enums/Plane";
import { createArrowPlacementData } from "../../../arrow/positioning/placement/domain/createArrowPlacementData";
import { GridLocation, GridMode } from "../../../grid/domain/enums/grid-enums";
import { type PropPlacementData } from "../../../prop/domain/models/PropPlacementData";
import { createPropPlacementData } from "../../../prop/domain/factories/createPropPlacementData";
import { PropType } from "../../../prop/domain/enums/PropType";
import {
  MotionColor,
  MotionType,
  RotationDirection,
  Orientation,
  HandPath,
  SkewDirection,
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
  readonly prefloatMotionType?: MotionType | null;
  readonly prefloatRotationDirection?: RotationDirection | null;

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
  // Only used by the 3D viewer — 2D pictographs ignore this field.
  readonly plane?: Plane;
}

/**
 * Runtime/rendered form of MotionData — extends domain data with viewer concerns.
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
    gridMode: data.gridMode ?? GridMode.DIAMOND, // Default to diamond mode for backward compatibility

    arrowPlacementData: data.arrowPlacementData ?? createArrowPlacementData(),
    propPlacementData: data.propPlacementData ?? createPropPlacementData(),

    prefloatMotionType: data.prefloatMotionType ?? null,
    prefloatRotationDirection: data.prefloatRotationDirection ?? null,

    handPath: data.handPath ?? null,
    skewSteps: data.skewSteps ?? null,
    skewDir: data.skewDir ?? null,
    plane: data.plane ?? undefined,
  };
}
