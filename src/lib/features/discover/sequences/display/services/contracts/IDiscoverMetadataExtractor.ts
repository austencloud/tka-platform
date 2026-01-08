/**
 * Service for extracting metadata from sequence files
 */

import type { BeatData } from "../../../../../create/shared/domain/models/BeatData";
import type { StartPositionData } from "../../../../../create/shared/domain/models/StartPositionData";
import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

export interface SequenceMetadata {
  beats: BeatData[];
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

export interface IDiscoverMetadataExtractor {
  /**
   * Extract metadata from a sequence file (PNG, WebP, or JSON sidecar)
   */
  extractMetadata(
    sequenceName: string,
    thumbnailPath?: string
  ): Promise<SequenceMetadata>;
}
