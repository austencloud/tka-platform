/**
 * Sequence Loopability Checker Implementation
 *
 * Determines if a sequence can loop seamlessly using the
 * isCircular flag set during sequence construction.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { ISequenceLoopabilityChecker } from "../contracts/ISequenceLoopabilityChecker";

export class SequenceLoopabilityChecker implements ISequenceLoopabilityChecker {
  /**
   * Check if a sequence returns to its starting position (LOOP pattern).
   * Uses the isCircular flag which is set when the sequence is built.
   */
  isSeamlesslyLoopable(sequence: SequenceData): boolean {
    // Use the explicit isCircular flag from the sequence data
    // This is set during sequence construction when a LOOP pattern is applied
    return sequence.isCircular === true;
  }
}
