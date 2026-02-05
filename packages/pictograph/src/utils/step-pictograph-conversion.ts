/**
 * Beat-Pictograph Conversion Utilities
 *
 * Helper functions to convert between StepData and PictographData.
 */

import type { StepData, PictographData } from "@tka/types";
import { createPictographData } from "../domain/factories";

export function beatDataToPictographData(
  stepData: StepData,
  isSelected: boolean = false
): PictographData {
  return {
    ...stepData,
    isSelected: isSelected || stepData.isSelected,
  } as PictographData;
}

export function extractCorePictographData(
  enhancedData: PictographData
): PictographData {
  return createPictographData({
    id: enhancedData.id,
    letter: enhancedData.letter ?? null,
    startPosition: enhancedData.startPosition ?? null,
    endPosition: enhancedData.endPosition ?? null,
    motions: enhancedData.motions,
  });
}

export function pictographDataToStepData(
  enhancedData: PictographData,
  stepId?: string
): StepData {
  const enhancedDataWithBeatContext = enhancedData as PictographData & {
    stepNumber?: number;
    duration?: number;
    blueReversal?: boolean;
    redReversal?: boolean;
    isBlank?: boolean;
  };

  return {
    ...enhancedData,
    id: stepId || enhancedData.id,
    stepNumber: enhancedDataWithBeatContext.stepNumber ?? 1,
    duration: enhancedDataWithBeatContext.duration ?? 1.0,
    blueReversal: enhancedDataWithBeatContext.blueReversal ?? false,
    redReversal: enhancedDataWithBeatContext.redReversal ?? false,
    isBlank: enhancedDataWithBeatContext.isBlank ?? false,
  };
}

export function hasStepContext(data: PictographData): boolean {
  const dataWithStepContext = data as PictographData & {
    stepNumber?: number;
    duration?: number;
    blueReversal?: boolean;
    redReversal?: boolean;
    isBlank?: boolean;
    isSelected?: boolean;
  };

  return (
    dataWithStepContext.stepNumber !== undefined ||
    dataWithStepContext.duration !== undefined ||
    dataWithStepContext.blueReversal !== undefined ||
    dataWithStepContext.redReversal !== undefined ||
    dataWithStepContext.isBlank !== undefined ||
    dataWithStepContext.isSelected !== undefined
  );
}

export function createStandalonePictographData(
  data: Partial<PictographData>
): PictographData {
  return createPictographData({
    id: data.id ?? "",
    letter: data.letter ?? null,
    startPosition: data.startPosition ?? null,
    endPosition: data.endPosition ?? null,
    motions: data.motions ?? {},
  });
}
