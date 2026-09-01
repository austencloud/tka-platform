/**
 * Data transformation and derivation logic for UI components.
 */

import type { PictographData } from "../../pictograph/shared/domain/models/pictograph-data";
import type { HandSide } from "../../pictograph/shared/domain/enums/pictograph-enums";
import type { MotionData } from "../../pictograph/shared/domain/models/motion-data";
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
  motions: Partial<Record<HandSide, MotionData | null>> | undefined,
): MotionRenderData[] {
  if (!motions) return [];

  return Object.entries(motions)
    .filter(([, motionData]) => motionData !== null && motionData !== undefined)
    .filter(([_, motionData]) => motionData!.isVisible)
    .map(([color, motionData]) => ({
      color: color as HandSide,
      motionData: motionData!,
    }));
}

export function getMotionsToRender(data: PictographData | null): MotionRenderData[] {
  if (!data?.motions) return [];
  const normalizedMotions: Partial<Record<HandSide, MotionData | null>> = {};
  for (const [key, value] of Object.entries(data.motions)) {
    normalizedMotions[key as HandSide] = value === undefined ? null : value;
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
