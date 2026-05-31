/**
 * Beat-Pictograph Conversion Utilities
 *
 * Helper functions to convert between StepData and enhanced PictographData
 * during the transition period. These utilities ensure smooth migration
 * while maintaining backward compatibility.
 */

import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import { createPictographData } from "../factories/create-pictograph-data";
import type { PictographData } from "../models/pictograph-data";

/**
 * Convert StepData to enhanced PictographData
 * Combines the pictograph data with beat context properties
 */
export function beatDataToPictographData(
  stepData: StepData,
  isSelected: boolean = false
): PictographData {
  // Since StepData extends PictographData, we can just return the stepData as PictographData
  // The beat context properties will be available but not enforced by the PictographData type
  return {
    ...stepData,
    isSelected: isSelected || stepData.isSelected,
  } as PictographData;
}

/**
 * Extract core PictographData from enhanced PictographData
 * Removes beat context properties to get pure pictograph data
 */
export function extractCorePictographData(
  enhancedData: PictographData
): PictographData {
  return createPictographData({
    id: enhancedData.id,
    letter: enhancedData.letter ?? null,
    startPosition: enhancedData.startPosition ?? null,
    endPosition: enhancedData.endPosition ?? null,
    motions: enhancedData.motions,
    // Explicitly exclude beat context properties
  });
}

/**
 * Convert enhanced PictographData back to StepData structure
 * Useful for maintaining compatibility with existing StepData-based services
 */
export function pictographDataToStepData(
  enhancedData: PictographData,
  stepId?: string
): StepData {
  // Since StepData extends PictographData, we can spread the pictograph data
  // and add the beat context properties
  const enhancedDataWithBeatContext = enhancedData as PictographData & {
    stepNumber?: number;
    duration?: number;
    blueReversal?: boolean;
    redReversal?: boolean;
    isBlank?: boolean;
  };

  return {
    ...enhancedData, // Spread all PictographData properties
    id: stepId || enhancedData.id,
    stepNumber: enhancedDataWithBeatContext.stepNumber ?? 1,
    duration: enhancedDataWithBeatContext.duration ?? 1.0,
    blueReversal: enhancedDataWithBeatContext.blueReversal ?? false,
    redReversal: enhancedDataWithBeatContext.redReversal ?? false,
    isBlank: enhancedDataWithBeatContext.isBlank ?? false,
  };
}

/**
 * Check if PictographData has beat context properties
 * Useful for determining if data came from a beat context
 */
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

/**
 * Create enhanced PictographData for standalone use
 * Ensures beat context properties are undefined for non-beat usage
 */
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
