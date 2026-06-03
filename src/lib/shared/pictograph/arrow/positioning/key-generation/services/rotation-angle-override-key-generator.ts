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
    const blueMotion = pictographData.motions.blue;
    const redMotion = pictographData.motions.red;
    if (!blueMotion || !redMotion) return false;

    const blueStart = blueMotion.startOrientation || "";
    const redStart = redMotion.startOrientation || "";

    const blueLayer1 = blueStart === Orientation.IN || blueStart === Orientation.OUT;
    const redLayer1 = redStart === Orientation.IN || redStart === Orientation.OUT;

    return blueLayer1 !== redLayer1;
  } catch {
    return false;
  }
}

function endsInMixedOrientation(pictographData: PictographData): boolean {
  try {
    const blueMotion = pictographData.motions.blue;
    const redMotion = pictographData.motions.red;
    if (!blueMotion || !redMotion) return false;

    const blueEnd = blueMotion.endOrientation || "";
    const redEnd = redMotion.endOrientation || "";

    const blueLayer1 = blueEnd === Orientation.IN || blueEnd === Orientation.OUT;
    const redLayer1 = redEnd === Orientation.IN || redEnd === Orientation.OUT;

    return blueLayer1 !== redLayer1;
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
  const color = motionData.color || "";

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
