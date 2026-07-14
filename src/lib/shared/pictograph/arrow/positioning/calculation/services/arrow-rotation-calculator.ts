import type { GridLocation } from "../../../../grid/domain/enums/grid-enums";
import {
  MotionType,
  Orientation,
} from "../../../../shared/domain/enums/pictograph-enums";
import type { MotionData } from "../../../../shared/domain/models/motion-data";
import type { PictographData } from "../../../../shared/domain/models/pictograph-data";
import type { SpecialPlacer } from "../../placement/services/special-placer";
import type { IRotationAngleOverrideKeyGenerator } from "../../key-generation/services/rotation-angle-override-key-generator";
import { dashNoRotationMap } from "../config/dash-rotation-maps";
import {
  selectStaticMap,
  selectProMap,
  selectAntiMap,
  selectDashMap,
  selectFloatMap,
} from "../utils/rotation-map-selector";
import { calculateSkewedFloatRotation } from "../config/float-rotation-maps";
import { checkAndApplyOverride } from "../utils/rotation-override-checker";
import { isNoRotation } from "../utils/rotation-direction-utils";
import { calculateHandpathDirection } from "./handpath-direction-calculator";
import { calculateSegmentRotation } from "./segment-rotation";

export class ArrowRotationCalculator {
  /**
   * Pure algorithmic service for calculating arrow rotation angles.
   *
   * Implements rotation calculation algorithms without any UI dependencies.
   * Each motion type has its own rotation strategy based on proven algorithms.
   *
   * ROTATION OVERRIDE SYSTEM:
   * - For DASH and STATIC motions, certain pictographs require different rotation angles
   * - These overrides are flagged in special placement JSON data
   * - When override flag is present, uses override rotation maps instead of normal maps
   *
   * REFACTORING NOTES:
   * - Rotation maps are extracted to dedicated config files for maintainability
   * - Map selection logic is centralized in RotationMapSelector utility
   * - Override checking logic is centralized in RotationOverrideChecker utility
   * - Handpath direction calculation is delegated to HandpathDirectionCalculator service
   * - Rotation direction normalization is handled by RotationDirectionUtils
   */

  constructor(
    private SpecialPlacer?: SpecialPlacer,
    private rotationOverrideKeyGenerator?: IRotationAngleOverrideKeyGenerator
  ) {}

  async calculateRotation(
    motion: MotionData,
    location: GridLocation,
    pictographData?: PictographData
  ): Promise<number> {
    /**
     * Calculate arrow rotation angle based on motion type and location.
     *
     * Args:
     *     motion: Motion data containing type and rotation direction
     *     location: Calculated arrow location
     *     pictographData: Optional pictograph data for rotation override checking
     *
     * Returns:
     *     Rotation angle in degrees (0-360)
     */
    // Half-motion frames: rotation is the staff angle at the segment end, derived
    // from Phase 1's pure orientation→angle bijection (endOrientation carries the
    // halfway orientation). Pure — no animation-engine dependency in this pipeline.
    if (motion.segment) {
      return calculateSegmentRotation(
        motion.endOrientation,
        location,
        motion.startLocation
      );
    }

    const motionType = motion.motionType.toLowerCase();

    switch (motionType) {
      case "static":
        return await this.calculateStaticRotation(
          motion,
          location,
          pictographData
        );
      case "pro":
        return this.calculateProRotation(motion, location);
      case "anti":
        return this.calculateAntiRotation(motion, location);
      case "dash":
        return await this.calculateDashRotation(
          motion,
          location,
          pictographData
        );
      case "float":
        return this.calculateFloatRotation(motion, location);
      default:
        console.warn(`Unknown motion type: ${motionType}, returning 0.0`);
        return 0.0;
    }
  }

  private async calculateStaticRotation(
    motion: MotionData,
    location: GridLocation,
    pictographData?: PictographData
  ): Promise<number> {
    /**
     * Calculate rotation for static arrows.
     * Uses different rotation maps based on whether orientation is radial (IN/OUT) or non-radial (CLOCK/COUNTER).
     * Radial = Diamond mode, Non-radial = Box mode.
     *
     * Both normal and override map selection use START orientation, matching the
     * legacy desktop calculator. Half-turn motions (different start/end radiality)
     * still resolve against the start-orientation layer.
     */
    const startOrientation = motion.startOrientation;
    const rotationDirection = motion.rotationDirection.toLowerCase();

    const isStartRadial =
      startOrientation === Orientation.IN ||
      startOrientation === Orientation.OUT;

    const overrideRotation = await this.checkRotationOverride(
      motion,
      location,
      pictographData,
      isStartRadial
    );

    if (overrideRotation !== null) {
      return overrideRotation;
    }

    const rotationMap = selectStaticMap(
      isStartRadial,
      rotationDirection
    );

    const finalAngle = rotationMap[location] || 0.0;

    return finalAngle;
  }

  private calculateProRotation(
    motion: MotionData,
    location: GridLocation
  ): number {
    /**Calculate rotation for PRO arrows based on rotation direction.*/
    const rotationMap = selectProMap(
      motion.rotationDirection.toLowerCase()
    );
    return rotationMap[location] || 0.0;
  }

  private calculateAntiRotation(
    motion: MotionData,
    location: GridLocation
  ): number {
    /**Calculate rotation for ANTI arrows based on rotation direction.*/
    const rotationMap = selectAntiMap(
      motion.rotationDirection.toLowerCase()
    );
    return rotationMap[location] || 0.0;
  }

  private async calculateDashRotation(
    motion: MotionData,
    location: GridLocation,
    pictographData?: PictographData
  ): Promise<number> {
    /**
     * Calculate rotation for DASH arrows with special NO_ROTATION handling.
     *
     * Override map selection uses START orientation to match the legacy
     * desktop calculator.
     */
    const rotationDirection = motion.rotationDirection.toLowerCase();
    const startOrientation = motion.startOrientation;

    const isStartRadial =
      startOrientation === Orientation.IN ||
      startOrientation === Orientation.OUT;

    const overrideRotation = await this.checkRotationOverride(
      motion,
      location,
      pictographData,
      isStartRadial
    );

    if (overrideRotation !== null) {
      return overrideRotation;
    }

    // STEP 2: Use normal rotation maps (no override)
    // For 0-turn dashes, always use the start/end pair map - rotation direction
    // is meaningless at 0 turns and may be incorrectly set to cw/ccw
    if (isNoRotation(rotationDirection) || motion.turns === 0) {
      const key = `${motion.startLocation},${motion.endLocation}`;
      return dashNoRotationMap[key] || 0.0;
    }

    const rotationMap = selectDashMap(rotationDirection);
    return rotationMap[location] || 0.0;
  }

  private calculateFloatRotation(
    motion: MotionData,
    location: GridLocation
  ): number {
    /**
     * Calculate rotation for FLOAT arrows.
     *
     * IMPORTANT: Float rotation is based on HANDPATH DIRECTION, not prop rotation direction!
     * Handpath direction is determined by the motion from start location to end location.
     *
     * For adjacent pairs (CW/CCW), uses predefined rotation maps.
     * For skewed/cross-grid pairs (e.g. N→SE, W→NE), computes the geometric angle
     * from start to end position since the handpath direction maps only cover
     * adjacent same-grid pairs.
     */
    const handpathDirection = calculateHandpathDirection(
      motion.startLocation,
      motion.endLocation
    );

    // Use handpath direction to select the correct rotation map
    if (handpathDirection === "cw" || handpathDirection === "ccw") {
      const rotationMap = selectFloatMap(handpathDirection);
      return rotationMap[location] || 0.0;
    }

    // For skewed/cross-grid shifts (start !== end but not in CW/CCW maps),
    // compute geometric angle from start position toward end position.
    // This handles cardinal→intercardinal (N→NE), intercardinal→cardinal (NE→S),
    // and non-adjacent same-grid pairs (N→SE, W→NE, etc.).
    if (handpathDirection === "dash" && motion.startLocation !== motion.endLocation) {
      const skewedAngle = calculateSkewedFloatRotation(
        motion.startLocation,
        motion.endLocation
      );
      if (skewedAngle !== null) {
        return skewedAngle;
      }
    }

    // Fallback for truly static movements (start === end)
    return 0.0;
  }

  /**
   * Check for rotation override and return override angle if it exists.
   *
   * @param motion - Motion data
   * @param location - Grid location
   * @param pictographData - Optional pictograph data
   * @param isStartRadial - Whether START orientation is radial (for override map selection)
   * @returns Override rotation angle if override exists, null otherwise
   */
  private async checkRotationOverride(
    motion: MotionData,
    location: GridLocation,
    pictographData: PictographData | undefined,
    isStartRadial: boolean
  ): Promise<number | null> {
    if (!pictographData) {
      return null;
    }
    if (!this.SpecialPlacer) {
      return null;
    }
    if (!this.rotationOverrideKeyGenerator) {
      return null;
    }

    return checkAndApplyOverride(
      motion,
      location,
      pictographData,
      isStartRadial,
      this.SpecialPlacer,
      this.rotationOverrideKeyGenerator
    );
  }

  getSupportedMotionTypes(): MotionType[] {
    /**Get list of motion types supported by this calculator.*/
    return [
      MotionType.STATIC,
      MotionType.PRO,
      MotionType.ANTI,
      MotionType.DASH,
      MotionType.FLOAT,
    ];
  }

  validateMotionData(motion: MotionData): boolean {
    /**Validate that motion data is suitable for rotation calculation.*/
    if (!motion) {
      return false;
    }

    const motionType = motion.motionType.toLowerCase();
    if (!this.getSupportedMotionTypes().includes(motionType as MotionType)) {
      return false;
    }

    if (!motion.rotationDirection) {
      return false;
    }

    return true;
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
// Use this instead of arrowRotationCalculator to avoid DI container rebuilds.
// ============================================================================

import { specialPlacer } from "../../placement/services/special-placer";
import { rotationAngleOverrideKeyGenerator } from "../../key-generation/services/rotation-angle-override-key-generator";

export const arrowRotationCalculator = new ArrowRotationCalculator(
  specialPlacer,
  rotationAngleOverrideKeyGenerator
);
