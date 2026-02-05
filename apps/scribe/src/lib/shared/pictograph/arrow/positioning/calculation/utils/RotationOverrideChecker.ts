import type { GridLocation } from "../../../../grid/domain/enums/grid-enums";
import type { PictographData } from "../../../../shared/domain/models/PictographData";
import type { MotionData } from "../../../../shared/domain/models/MotionData";
import type { ISpecialPlacer } from "../../placement/services/contracts/IArrowPlacer";
import type { IRotationAngleOverrideKeyGenerator } from "../../key-generation/services/implementations/RotationAngleOverrideKeyGenerator";
import { RotationMapSelector } from "./RotationMapSelector";
import { normalizeRotationDirection } from "./RotationDirectionUtils";

/**
 * Utility class for checking and applying rotation angle overrides.
 *
 * Centralizes override checking logic to eliminate duplication between
 * STATIC and DASH rotation calculations.
 */
export class RotationOverrideChecker {
  /**
   * Check if rotation override exists and calculate the override rotation angle.
   *
   * @param motion - Motion data containing type and rotation information
   * @param location - Grid location for the arrow
   * @param pictographData - Pictograph data for override checking
   * @param isRadial - Whether the orientation is radial (IN/OUT) - only used for STATIC/DASH
   * @param SpecialPlacer - Service for checking special placements
   * @param rotationOverrideKeyGenerator - Generator for override keys
   * @returns Override rotation angle if override exists, null otherwise
   */
  static async checkAndApplyOverride(
    motion: MotionData,
    location: GridLocation,
    pictographData: PictographData,
    isRadial: boolean,
    SpecialPlacer: ISpecialPlacer,
    rotationOverrideKeyGenerator: IRotationAngleOverrideKeyGenerator
  ): Promise<number | null> {
    try {
      const overrideKey =
        rotationOverrideKeyGenerator.generateRotationAngleOverrideKey(
          motion,
          pictographData
        );

      const hasOverride = await SpecialPlacer.hasRotationAngleOverride(
        motion,
        pictographData,
        overrideKey
      );

      if (hasOverride) {
        const overrideAngle = this.getRotationFromOverrideMap(
          isRadial,
          location,
          motion.rotationDirection
        );

        return overrideAngle;
      }
    } catch (error) {
      // If override check fails, return null to fall through to normal rotation
      console.warn("Rotation override check failed:", error);
    }

    return null;
  }

  /**
   * Get rotation angle from override maps.
   *
   * Override maps may have conditional angles based on rotation direction.
   *
   * @param isRadial - Whether the orientation is radial (IN/OUT)
   * @param location - Grid location for the arrow
   * @param rotationDirection - The rotation direction string
   * @returns Rotation angle from override map
   */
  private static getRotationFromOverrideMap(
    isRadial: boolean,
    location: GridLocation,
    rotationDirection: string
  ): number {
    const overrideMap = RotationMapSelector.selectStaticOverrideMap(isRadial);
    const angleValue = overrideMap[location];

    if (typeof angleValue === "number") {
      return angleValue;
    } else if (typeof angleValue === "object") {
      // Angle depends on rotation direction
      const dir = normalizeRotationDirection(rotationDirection);
      return angleValue[dir] || 0.0;
    }

    return 0.0;
  }
}
