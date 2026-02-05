/**
 * Sequence Loopability Checker Interface
 *
 * Determines if a sequence can loop seamlessly without showing
 * the start position beat again (when end state matches start state).
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export interface ISequenceLoopabilityChecker {
  /**
   * Check if a sequence ends in the exact same position and orientation as it starts
   *
   * @param sequence - The sequence to check
   * @returns true if the sequence can loop seamlessly (end state = start state)
   */
  isSeamlesslyLoopable(sequence: SequenceData): boolean;
}
