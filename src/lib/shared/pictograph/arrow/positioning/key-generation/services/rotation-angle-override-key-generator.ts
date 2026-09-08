/**
 * Rotation Angle Override Key Generator
 *
 * Generates keys for looking up rotation angle overrides in special placement JSON data.
 */

import type { PictographData } from "../../../../shared/domain/models/pictograph-data";
import type { MotionData } from "../../../../shared/domain/models/motion-data";
import { Orientation } from "../../../../shared/domain/enums/pictograph-enums";

export interface IRotationAngleOverrideKeyGenerator {
  generateRotationAngleOverrideKey(
    motionData: MotionData,
    pictographData: PictographData
  ): string;
}

function getStartOriLayer(motionData: MotionData): string {
  const startOri = motionData.startOrientation;
  if (startOri === Orientation.IN || startOri === Orientation.OUT) {
    return "layer1";
  } else if (startOri === Orientation.CLOCK || startOri === Orientation.COUNTER) {
    return "layer2";
  }
  return "layer1";
}

function startsFromMixedOrientation(pictographData: PictographData): boolean {
  try {
    const leftMotion = pictographData.motions.left;
    const rightMotion = pictographData.motions.right;
    if (!leftMotion || !rightMotion) return false;

    const leftStart = leftMotion.startOrientation || "";
    const rightStart = rightMotion.startOrientation || "";

    const leftLayer1 = leftStart === Orientation.IN || leftStart === Orientation.OUT;
    const rightLayer1 = rightStart === Orientation.IN || rightStart === Orientation.OUT;

    return leftLayer1 !== rightLayer1;
  } catch {
    return false;
  }
}

function endsInMixedOrientation(pictographData: PictographData): boolean {
  try {
    const leftMotion = pictographData.motions.left;
    const rightMotion = pictographData.motions.right;
    if (!leftMotion || !rightMotion) return false;

    const leftEnd = leftMotion.endOrientation || "";
    const rightEnd = rightMotion.endOrientation || "";

    const leftLayer1 = leftEnd === Orientation.IN || leftEnd === Orientation.OUT;
    const rightLayer1 = rightEnd === Orientation.IN || rightEnd === Orientation.OUT;

    return leftLayer1 !== rightLayer1;
  } catch {
    return false;
  }
}

export function generateRotationAngleOverrideKey(
  motionData: MotionData,
  pictographData: PictographData
): string {
  const motionType = motionData.motionType.toLowerCase() || "";
  const letter = pictographData.letter || "";
  const color = motionData.hand || "";

  if (startsFromMixedOrientation(pictographData)) {
    const startOriLayer = getStartOriLayer(motionData);
    return `${motionType}_from_${startOriLayer}_rot_angle_override`;
  }

  if (
    !startsFromMixedOrientation(pictographData) &&
    endsInMixedOrientation(pictographData)
  ) {
    const startOriLayer = getStartOriLayer(motionData);
    return `${motionType}_from_${startOriLayer}_rot_angle_override`;
  }

  const specialLetters = ["α", "β", "γ", "Φ-", "Ψ-", "Λ-"];
  if (specialLetters.includes(letter)) {
    return `${color}_rot_angle_override`;
  }

  return `${motionType}_rot_angle_override`;
}

/** Adapter object implementing IRotationAngleOverrideKeyGenerator interface */
export const rotationAngleOverrideKeyGenerator: IRotationAngleOverrideKeyGenerator = {
  generateRotationAngleOverrideKey,
};
