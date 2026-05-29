/**
 * Data transformation and derivation logic for UI components.
 */

import type { PictographData } from "../../pictograph/shared/domain/models/PictographData";
import type { MotionColor } from "../../pictograph/shared/domain/enums/pictograph-enums";
import type { MotionData } from "../../pictograph/shared/domain/models/MotionData";
import type { MotionRenderData, PictographDisplayData } from "./types";

export function getEffectivePictographData(
  pictographData?: PictographData | null,
): PictographData | null {
  return pictographData || null;
}

export function hasValidPictographData(data: PictographData | null): boolean {
  return data != null;
}

export function getDisplayLetter(data: PictographData | null): string | null {
  if (data?.letter) return data.letter;
  return null;
}

export function filterVisibleMotions(
  motions: Partial<Record<MotionColor, MotionData | null>> | undefined,
): MotionRenderData[] {
  if (!motions) return [];

  return Object.entries(motions)
    .filter(([, motionData]) => motionData !== null && motionData !== undefined)
    .filter(([_, motionData]) => motionData!.isVisible)
    .map(([color, motionData]) => ({
      color: color as MotionColor,
      motionData: motionData!,
    }));
}

export function getMotionsToRender(data: PictographData | null): MotionRenderData[] {
  if (!data?.motions) return [];
  const normalizedMotions: Partial<Record<MotionColor, MotionData | null>> = {};
  for (const [key, value] of Object.entries(data.motions)) {
    normalizedMotions[key as MotionColor] = value === undefined ? null : value;
  }
  return filterVisibleMotions(normalizedMotions);
}

export function transformPictographData(
  pictographData?: PictographData | null,
): PictographDisplayData {
  const effectivePictographData = getEffectivePictographData(pictographData);

  return {
    effectivePictographData,
    hasValidData: hasValidPictographData(effectivePictographData),
    displayLetter: getDisplayLetter(effectivePictographData),
    motionsToRender: getMotionsToRender(effectivePictographData),
  };
}
