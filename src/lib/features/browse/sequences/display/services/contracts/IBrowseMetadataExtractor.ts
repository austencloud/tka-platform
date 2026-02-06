/**
 * Service for extracting metadata from sequence files
 */

import type { StepData } from "../../../../../create/shared/domain/models/StepData";
import type { StartPositionData } from "../../../../../create/shared/domain/models/StartPositionData";
import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

export interface SequenceMetadata {
  steps: StepData[];
  author: string;
  difficultyLevel: string;
  dateAdded: Date;
  gridMode: GridMode;
  isCircular: boolean;
  propType: PropType;
  sequenceLength: number;
  startingPosition: string; // Just the letter/position name (e.g., "gamma")
  startPosition?: StartPositionData; // Full start position data with motions
}

export interface IBrowseMetadataExtractor {
  /**
   * Extract metadata from a sequence file (PNG, WebP, or JSON sidecar)
   */
  extractMetadata(
    sequenceName: string,
    thumbnailPath?: string
  ): Promise<SequenceMetadata>;
}
