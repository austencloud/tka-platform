import type { GridLocation } from "../../../../grid/domain/enums/grid-enums";
import type { PictographData } from "../../../../shared/domain/models/PictographData";
import type { MotionData } from "../../../../shared/domain/models/MotionData";
import type { SpecialPlacer } from "../../placement/services/special-placer";
import type { IRotationAngleOverrideKeyGenerator } from "../../key-generation/services/rotation-angle-override-key-generator";
import { selectStaticOverrideMap } from "./rotation-map-selector";
import { normalizeRotationDirection } from "./RotationDirectionUtils";

export async function checkAndApplyOverride(
  motion: MotionData,
  location: GridLocation,
  pictographData: PictographData,
  isRadial: boolean,
  SpecialPlacerService: SpecialPlacer,
  rotationOverrideKeyGenerator: IRotationAngleOverrideKeyGenerator
): Promise<number | null> {
  try {
    const overrideKey =
      rotationOverrideKeyGenerator.generateRotationAngleOverrideKey(
        motion,
        pictographData
      );

    const hasOverride = await SpecialPlacerService.hasRotationAngleOverride(
      motion,
      pictographData,
      overrideKey
    );

    if (hasOverride) {
      return getRotationFromOverrideMap(isRadial, location, motion.rotationDirection);
    }
  } catch (error) {
    console.warn("Rotation override check failed:", error);
  }

  return null;
}

function getRotationFromOverrideMap(
  isRadial: boolean,
  location: GridLocation,
  rotationDirection: string
): number {
  const overrideMap = selectStaticOverrideMap(isRadial);
  const angleValue = overrideMap[location];

  if (typeof angleValue === "number") {
    return angleValue;
  } else if (typeof angleValue === "object") {
    const dir = normalizeRotationDirection(rotationDirection);
    return angleValue[dir] || 0.0;
  }

  return 0.0;
}
