/**
 * Beat-Pictograph Conversion Utilities
 *
 * Helper functions to convert between BeatData and enhanced PictographData
 * during the transition period. These utilities ensure smooth migration
 * while maintaining backward compatibility.
 */

import type { BeatData } from "../../../../../features/create/shared/domain/models/BeatData";
import { createPictographData } from "../factories/createPictographData";
import type { PictographData } from "../models/PictographData";

/**
 * Convert BeatData to enhanced PictographData
 * Combines the pictograph data with beat context properties
 */
export function beatDataToPictographData(
  beatData: BeatData,
  isSelected: boolean = false
): PictographData {
  // Since BeatData extends PictographData, we can just return the beatData as PictographData
  // The beat context properties will be available but not enforced by the PictographData type
  return {
    ...beatData,
    isSelected: isSelected || beatData.isSelected,
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
 * Convert enhanced PictographData back to BeatData structure
 * Useful for maintaining compatibility with existing BeatData-based services
 */
export function pictographDataToBeatData(
  enhancedData: PictographData,
  beatId?: string
): BeatData {
  // Since BeatData extends PictographData, we can spread the pictograph data
  // and add the beat context properties
  const enhancedDataWithBeatContext = enhancedData as PictographData & {
    beatNumber?: number;
    duration?: number;
    blueReversal?: boolean;
    redReversal?: boolean;
    isBlank?: boolean;
  };

  return {
    ...enhancedData, // Spread all PictographData properties
    id: beatId || enhancedData.id,
    beatNumber: enhancedDataWithBeatContext.beatNumber ?? 1,
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
export function hasBeatContext(data: PictographData): boolean {
  const dataWithBeatContext = data as PictographData & {
    beatNumber?: number;
    duration?: number;
    blueReversal?: boolean;
    redReversal?: boolean;
    isBlank?: boolean;
    isSelected?: boolean;
  };

  return (
    dataWithBeatContext.beatNumber !== undefined ||
    dataWithBeatContext.duration !== undefined ||
    dataWithBeatContext.blueReversal !== undefined ||
    dataWithBeatContext.redReversal !== undefined ||
    dataWithBeatContext.isBlank !== undefined ||
    dataWithBeatContext.isSelected !== undefined
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
