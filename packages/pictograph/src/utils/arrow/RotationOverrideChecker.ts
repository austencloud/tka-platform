import type { GridLocation, PictographData, MotionData } from "@tka/types";
import { RotationMapSelector } from "./RotationMapSelector";
import { normalizeRotationDirection } from "./RotationDirectionUtils";

/**
 * Interfaces for rotation override dependencies.
 * These are injected at construction time, allowing scribe to provide its
 * special placement system while the package remains decoupled.
 */
export interface ISpecialPlacer {
  hasRotationAngleOverride(
    motion: MotionData,
    pictographData: PictographData,
    overrideKey: string
  ): Promise<boolean>;
}

export interface IRotationAngleOverrideKeyGenerator {
  generateRotationAngleOverrideKey(
    motion: MotionData,
    pictographData: PictographData
  ): string;
}

/**
 * Utility class for checking and applying rotation angle overrides.
 *
 * Centralizes override checking logic to eliminate duplication between
 * STATIC and DASH rotation calculations.
 */
export class RotationOverrideChecker {
  static async checkAndApplyOverride(
    motion: MotionData,
    location: GridLocation,
    pictographData: PictographData,
    isRadial: boolean,
    specialPlacer: ISpecialPlacer,
    rotationOverrideKeyGenerator: IRotationAngleOverrideKeyGenerator
  ): Promise<number | null> {
    try {
      const overrideKey =
        rotationOverrideKeyGenerator.generateRotationAngleOverrideKey(
          motion,
          pictographData
        );

      const hasOverride = await specialPlacer.hasRotationAngleOverride(
        motion,
        pictographData,
        overrideKey
      );

      if (hasOverride) {
        return this.getRotationFromOverrideMap(
          isRadial,
          location,
          motion.rotationDirection
        );
      }
    } catch (error) {
      console.warn("Rotation override check failed:", error);
    }

    return null;
  }

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
      const dir = normalizeRotationDirection(rotationDirection);
      return angleValue[dir] || 0.0;
    }

    return 0.0;
  }
}
