/**
 * Orientation Cycle Extender Service Contract
 *
 * Extends sequences that need multiple repetitions to return to their
 * starting prop orientation. For swapped LOOP sequences, a single pass
 * may return to the correct grid position but with rotated orientations.
 * This service duplicates the beats for each additional pass, recalculating
 * orientations so the performer sees the actual pictographs.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export interface IOrientationCycleExtender {
  /**
   * Detect orientation cycle count and extend the sequence if needed.
   *
   * @param sequence The sequence to potentially extend
   * @returns The original sequence (cycleCount=1) or an extended sequence
   *          with duplicated + re-oriented beats and updated orientationCycleCount
   */
  extendIfNeeded(sequence: SequenceData): SequenceData;
}
