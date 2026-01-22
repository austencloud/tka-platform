/**
 * Sequence Loopability Checker Implementation
 *
 * Determines if a sequence can loop seamlessly by:
 * 1. Using the isCircular flag if set during sequence construction
 * 2. Analyzing actual positions if flag is missing (legacy sequences)
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { ISequenceLoopabilityChecker } from "../contracts/ISequenceLoopabilityChecker";

export class SequenceLoopabilityChecker implements ISequenceLoopabilityChecker {
  /**
   * Check if a sequence returns to its starting position (LOOP pattern).
   *
   * Priority:
   * 1. If isCircular flag is explicitly set, use it
   * 2. Otherwise, analyze the actual positions to determine circularity
   */
  isSeamlesslyLoopable(sequence: SequenceData): boolean {
    // Use explicit flag if available
    if (sequence.isCircular !== undefined) {
      return sequence.isCircular === true;
    }

    // Analyze positions for legacy sequences without the flag
    return this.analyzePositionCircularity(sequence);
  }

  /**
   * Analyze the actual positions to determine if sequence is circular.
   * Compares the end position of the last step with the start position.
   */
  private analyzePositionCircularity(sequence: SequenceData): boolean {
    const steps = sequence.steps;
    if (!steps || steps.length < 1) return false;

    // Get start position (from startPosition field or first step's startPosition)
    const startPos = sequence.startPosition || steps[0]?.startPosition;
    if (!startPos) return false;

    // Get the last step's end position
    const lastStep = steps[steps.length - 1];
    if (!lastStep) return false;

    // For circularity, the end position should match the start position
    const endPos = lastStep.endPosition;
    if (!endPos) return false;

    // Position names should match exactly
    return startPos === endPos;
  }
}
