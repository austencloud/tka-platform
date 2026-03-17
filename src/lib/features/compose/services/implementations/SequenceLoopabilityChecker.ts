/**
 * Sequence Loopability Checker Implementation
 *
 * Determines if a sequence can loop seamlessly by checking BOTH:
 * 1. Grid position: last step ends where start position begins
 * 2. Orientations: both props end with the same orientation they started with
 *
 * A sequence that returns to its starting position but with different
 * orientations would cause a visible jump at the loop boundary.
 */

import type { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { ISequenceLoopabilityChecker } from "../contracts/ISequenceLoopabilityChecker";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

export class SequenceLoopabilityChecker implements ISequenceLoopabilityChecker {
  /**
   * Check if a sequence can loop seamlessly — position AND orientation must match.
   *
   * Even when isCircular is set (meaning the extension code built a full cycle),
   * we still verify orientations match. A positional cycle doesn't guarantee an
   * orientation cycle. For example, 8 beats of ΔROW returns to alpha1 but with
   * red orientation "out" instead of the starting "in".
   */
  isSeamlesslyLoopable(sequence: SequenceData): boolean {
    if (!this.analyzePositionCircularity(sequence)) {
      return false;
    }

    return this.analyzeOrientationCircularity(sequence);
  }

  /**
   * Check if grid positions match: last step ends where start position begins.
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

  /**
   * Check if the last step's end orientations match the start position's orientations.
   *
   * Compares each prop's endOrientation on the last step against the
   * endOrientation on the start position (which equals the first step's
   * startOrientation). If either prop doesn't match, the animation would
   * show a visible jump at the loop boundary.
   */
  private analyzeOrientationCircularity(sequence: SequenceData): boolean {
    const steps = sequence.steps;
    if (!steps || steps.length < 1) return false;

    const startPosData = sequence.startPosition ?? sequence.startingPosition;
    if (!startPosData?.motions) return false;

    const lastStep = steps[steps.length - 1];
    if (!lastStep?.motions) return false;

    // Compare blue prop orientation
    const startBlue = startPosData.motions[MotionColor.BLUE];
    const endBlue = lastStep.motions[MotionColor.BLUE];
    if (startBlue && endBlue) {
      if (startBlue.endOrientation !== endBlue.endOrientation) {
        return false;
      }
    }

    // Compare red prop orientation
    const startRed = startPosData.motions[MotionColor.RED];
    const endRed = lastStep.motions[MotionColor.RED];
    if (startRed && endRed) {
      if (startRed.endOrientation !== endRed.endOrientation) {
        return false;
      }
    }

    return true;
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
export const sequenceLoopabilityChecker = new SequenceLoopabilityChecker();
