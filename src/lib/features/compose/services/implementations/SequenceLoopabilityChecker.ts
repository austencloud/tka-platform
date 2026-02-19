/**
 * Sequence Loopability Checker Implementation
 *
 * Determines if a sequence can loop seamlessly by:
 * 1. Using the isCircular flag if set during sequence construction
 * 2. Analyzing actual positions if flag is missing (legacy sequences)
 */

import type { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { ISequenceLoopabilityChecker } from "../contracts/ISequenceLoopabilityChecker";

export class SequenceLoopabilityChecker implements ISequenceLoopabilityChecker {
  /**
   * Check if a sequence returns to its starting position (LOOP pattern).
   *
   * If isCircular is explicitly true, trust it immediately.
   * Otherwise, always run position analysis — isCircular defaults to false
   * in createSequenceData(), so a false value doesn't mean "verified non-circular".
   */
  isSeamlesslyLoopable(sequence: SequenceData): boolean {
    if (sequence.isCircular === true) {
      return true;
    }

    return this.analyzePositionCircularity(sequence);
  }

  /**
   * Analyze the actual positions to determine if sequence is circular.
   * Extracts GridPosition strings from the StartPositionData object and
   * compares against the last step's endPosition.
   */
  private analyzePositionCircularity(sequence: SequenceData): boolean {
    const steps = sequence.steps;
    if (!steps || steps.length < 1) return false;

    const startPosData = sequence.startPosition ?? sequence.startingPosition;
    const startGridPos: GridPosition | null | undefined =
      startPosData?.startPosition ?? startPosData?.gridPosition ?? steps[0]?.startPosition;
    if (!startGridPos) return false;

    const lastStep = steps[steps.length - 1];
    if (!lastStep?.endPosition) return false;

    return startGridPos === lastStep.endPosition;
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
export const sequenceLoopabilityChecker = new SequenceLoopabilityChecker();
