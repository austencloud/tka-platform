import type { GridLocation } from "../../../../grid/domain/enums/grid-enums";
import type { PictographData } from "../../../../shared/domain/models/pictograph-data";
import type { MotionData } from "../../../../shared/domain/models/motion-data";
import type { SpecialPlacer } from "../../placement/services/special-placer";
import type { IRotationAngleOverrideKeyGenerator } from "../../key-generation/services/rotation-angle-override-key-generator";
import { dashNoRotationMap } from "../config/dash-rotation-maps";
import {
  selectDashOverrideMap,
  selectStaticOverrideMap,
} from "./rotation-map-selector";
import {
  isNoRotation,
  normalizeRotationDirection,
} from "./rotation-direction-utils";

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
      return getRotationFromOverrideMap(
        motion,
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

function getRotationFromOverrideMap(
  motion: MotionData,
  isRadial: boolean,
  location: GridLocation,
  rotationDirection: string
): number {
  if (motion.motionType.toLowerCase() === "dash") {
    if (isNoRotation(rotationDirection) || motion.turns === 0) {
      const key = `${motion.startLocation},${motion.endLocation}`;
      return dashNoRotationMap[key] ?? 0.0;
    }

    return selectDashOverrideMap(rotationDirection)[location] ?? 0.0;
  }

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
