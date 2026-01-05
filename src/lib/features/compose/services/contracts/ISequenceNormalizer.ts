/**
 * Sequence Normalizer Interface
 *
 * Handles normalization of sequence data for consistent consumption by UI components.
 * Specifically handles the separation of beat 0 (start position) from the beats array.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StartPositionData } from "../../../create/shared/domain/models/StartPositionData";
import type { BeatData } from "../../../create/shared/domain/models/BeatData";

export interface NormalizedSequenceData {
  /**
   * Beats array with beatNumber >= 1 (excludes start position)
   */
  beats: readonly BeatData[];

  /**
   * Start position (always StartPositionData, never BeatData)
   */
  startPosition: StartPositionData | null;
}

export interface ISequenceNormalizer {
  /**
   * Normalize sequence data by separating start position from beats array.
   * Some sequences have startPosition as a separate field, others have it mixed
   * in the beats array as beatNumber 0.
   *
   * This ensures consistent data structure for components like BeatGrid.
   *
   * @param sequence The sequence to normalize
   * @returns Normalized data with beats and startPosition separated
   */
  separateBeatsFromStartPosition(
    sequence: SequenceData
  ): NormalizedSequenceData;
}
