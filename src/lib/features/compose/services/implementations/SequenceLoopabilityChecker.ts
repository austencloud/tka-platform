/**
 * Sequence Loopability Checker Implementation
 *
 * Determines if a sequence can loop seamlessly by comparing
 * the start and end positions/orientations of all props.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { ISequenceLoopabilityChecker } from "../contracts/ISequenceLoopabilityChecker";

export class SequenceLoopabilityChecker implements ISequenceLoopabilityChecker {
  /**
   * Check if a sequence ends in the exact same position and orientation as it starts
   */
  isSeamlesslyLoopable(sequence: SequenceData): boolean {
    if (!sequence.beats || sequence.beats.length === 0) {
      return false;
    }

    // Get first and last beats
    const firstBeat = sequence.beats[0];
    const lastBeat = sequence.beats[sequence.beats.length - 1];

    if (!firstBeat || !lastBeat) {
      return false;
    }

    // Check if positions match
    const positionsMatch = firstBeat.startPosition === lastBeat.endPosition;

    if (!positionsMatch) {
      return false;
    }

    // Check blue prop orientations (if blue motion exists)
    const blueMotionFirst = firstBeat.motions?.blue;
    const blueMotionLast = lastBeat.motions?.blue;

    if (blueMotionFirst && blueMotionLast) {
      const blueOrientationsMatch =
        blueMotionFirst.startOrientation === blueMotionLast.endOrientation;

      if (!blueOrientationsMatch) {
        return false;
      }
    } else if (blueMotionFirst || blueMotionLast) {
      // One has blue motion but the other doesn't - not seamless
      return false;
    }

    // Check red prop orientations (if red motion exists)
    const redMotionFirst = firstBeat.motions?.red;
    const redMotionLast = lastBeat.motions?.red;

    if (redMotionFirst && redMotionLast) {
      const redOrientationsMatch =
        redMotionFirst.startOrientation === redMotionLast.endOrientation;

      if (!redOrientationsMatch) {
        return false;
      }
    } else if (redMotionFirst || redMotionLast) {
      // One has red motion but the other doesn't - not seamless
      return false;
    }

    // All checks passed - sequence is seamlessly loopable
    return true;
  }
}
