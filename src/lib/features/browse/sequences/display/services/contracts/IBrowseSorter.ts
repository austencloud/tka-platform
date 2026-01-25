/**
 * Service for sorting and grouping gallery sequences
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { BrowseSortMethod } from "$lib/features/browse/shared/domain/enums/browse-enums";

export interface IBrowseSorter {
  /**
   * Sort sequences by the specified method
   */
  sortSequences(
    sequences: SequenceData[],
    sortMethod: BrowseSortMethod
  ): SequenceData[];

  /**
   * Group sequences into sections based on sort method
   */
  groupSequencesIntoSections(
    sequences: SequenceData[],
    sortMethod: BrowseSortMethod
  ): Record<string, SequenceData[]>;
}
