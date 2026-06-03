/**
 * Special Placement Ori Key Generator
 * Generates ori_key matching SpecialPlacer's internal logic.
 */

import type { MotionData } from "../../../../shared/domain/models/motion-data";
import type { PictographData } from "../../../../shared/domain/models/pictograph-data";

export function generateOrientationKey(
  _motionData: MotionData,
  pictographData: PictographData
): string {
  try {
    const blueMotion = pictographData.motions.blue;
    const redMotion = pictographData.motions.red;
    if (blueMotion && redMotion) {
      const blueStartOri = blueMotion.startOrientation || "in";
      const redStartOri = redMotion.startOrientation || "in";
      return `${blueStartOri}_${redStartOri}`;
    }
  } catch {
    // fallthrough
  }
  return "in_in";
}

export function mapToLegacyBucket(specificOriKey: string): string {
  const separatorIndex = specificOriKey.indexOf("_");
  const blueOri = separatorIndex >= 0 ? specificOriKey.slice(0, separatorIndex) : specificOriKey;
  const redOri = separatorIndex >= 0 ? specificOriKey.slice(separatorIndex + 1) : "in";
  const radialOrientations = ["in", "out"];
  const blueLayer = radialOrientations.includes(blueOri) ? 1 : 2;
  const redLayer = radialOrientations.includes(redOri) ? 1 : 2;

  if (blueLayer === 1 && redLayer === 1) return "from_layer1";
  if (blueLayer === 2 && redLayer === 2) return "from_layer2";
  if (blueLayer === 1 && redLayer === 2) return "from_layer3_blue1_red2";
  return "from_layer3_blue2_red1";
}

export function resolveEffectiveOriKey(
  specificOriKey: string,
  pictographData: PictographData
): string {
  const blueMotion = pictographData.motions.blue;
  const redMotion = pictographData.motions.red;
  const blueProp = blueMotion?.propType?.toLowerCase() || "staff";
  const redProp = redMotion?.propType?.toLowerCase() || "staff";

  if (blueProp === "staff" && redProp === "staff") {
    return mapToLegacyBucket(specificOriKey);
  }

  return specificOriKey;
}
