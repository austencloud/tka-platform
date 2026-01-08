/**
 * ISequenceMotionLoader
 *
 * Ensures sequence data has motion information for animation playback.
 * If motion data is missing, attempts to load it from the gallery.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export interface ISequenceMotionLoader {
  /**
   * Ensures the sequence has motion data for animation.
   * If the sequence already has motion data, returns it as-is.
   * If not, attempts to load full data from the gallery.
   *
   * @param seq - The sequence to check/enrich
   * @returns The sequence with motion data, or null if loading failed
   */
  ensureMotionData(seq: SequenceData): Promise<SequenceData | null>;
}
