/**
 * Special Placement Ori Key Generator
 * Generates ori_key matching SpecialPlacer's internal logic.
 */

import type { MotionData } from "../../../../shared/domain/models/motion-data";
import { isVisibleMotion } from "../../../../shared/domain/models/motion-data";
import type { PictographData } from "../../../../shared/domain/models/pictograph-data";

export function generateOrientationKey(
  _motionData: MotionData,
  pictographData: PictographData
): string {
  try {
    const leftMotion = pictographData.motions.left;
    const rightMotion = pictographData.motions.right;
    // Invisible placeholder = hand not really there (both-required Step
    // shape): keep the "in_in" fallback the old absent-hand path produced.
    if (isVisibleMotion(leftMotion) && isVisibleMotion(rightMotion)) {
      const leftStartOri = leftMotion.startOrientation || "in";
      const rightStartOri = rightMotion.startOrientation || "in";
      return `${leftStartOri}_${rightStartOri}`;
    }
  } catch {
    // fallthrough
  }
  return "in_in";
}

export function mapToLegacyBucket(specificOriKey: string): string {
  const separatorIndex = specificOriKey.indexOf("_");
  const leftOri =
    separatorIndex >= 0
      ? specificOriKey.slice(0, separatorIndex)
      : specificOriKey;
  const rightOri =
    separatorIndex >= 0 ? specificOriKey.slice(separatorIndex + 1) : "in";
  const leftLayer = getOrientationLayer(leftOri);
  const rightLayer = getOrientationLayer(rightOri);

  if (leftLayer === 1 && rightLayer === 1) return "from_layer1";
  if (leftLayer === 2 && rightLayer === 2) return "from_layer2";
  if (leftLayer === 1 && rightLayer === 2) return "from_layer3_blue1_red2";
  return "from_layer3_blue2_red1";
}

function getOrientationLayer(orientation: string): 1 | 2 {
  return orientation === "in" || orientation === "out" ? 1 : 2;
}

/**
 * The base special-placement bucket for one motion's starting orientation.
 * Mixed-orientation files can omit a letter or tuple that still has an
 * inherited rotation flag in this per-motion bucket.
 */
export function getMotionOrientationBucket(motionData: MotionData): string {
  return `from_layer${getOrientationLayer(motionData.startOrientation)}`;
}

export function resolveEffectiveOriKey(
  specificOriKey: string,
  pictographData: PictographData
): string {
  const leftMotion = pictographData.motions.left;
  const rightMotion = pictographData.motions.right;
  const leftProp = leftMotion?.propType?.toLowerCase() || "staff";
  const rightProp = rightMotion?.propType?.toLowerCase() || "staff";

  if (leftProp === "staff" && rightProp === "staff") {
    return mapToLegacyBucket(specificOriKey);
  }

  return specificOriKey;
}
