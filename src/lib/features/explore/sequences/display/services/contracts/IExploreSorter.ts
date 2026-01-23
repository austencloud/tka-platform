/**
 * Service for sorting and grouping gallery sequences
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { ExploreSortMethod } from "$lib/features/explore/shared/domain/enums/explore-enums";

export interface IExploreSorter {
  /**
   * Sort sequences by the specified method
   */
  sortSequences(
    sequences: SequenceData[],
    sortMethod: ExploreSortMethod
  ): SequenceData[];

  /**
   * Group sequences into sections based on sort method
   */
  groupSequencesIntoSections(
    sequences: SequenceData[],
    sortMethod: ExploreSortMethod
  ): Record<string, SequenceData[]>;
}
