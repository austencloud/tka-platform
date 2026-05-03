/**
 * Orientation Alignment Calculator Implementation
 *
 * Calculates orientation alignment for sequence extension.
 * Determines how many repetitions are needed for prop orientations
 * to return to their starting state after LOOP application.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { OrientationAlignment } from "../contracts/ISequenceExtender";
export class OrientationAlignmentCalculator {
  /**
   * Get the starting orientations from a sequence's start position.
   */
  getStartOrientations(
    sequence: SequenceData
  ): { blueOri: string; redOri: string } | null {
    const startPosData =
      sequence.startPosition || sequence.startingPosition;
    if (!startPosData) return null;

    // Extract orientations from motion data
    const motions = (startPosData as unknown as Record<string, unknown>)
      .motions as Record<string, unknown> | undefined;

    if (!motions) {
      // Try legacy format with direct blue/red properties
      const blueData = (startPosData as unknown as Record<string, unknown>)
        .blue as Record<string, unknown> | undefined;
      const redData = (startPosData as unknown as Record<string, unknown>)
        .red as Record<string, unknown> | undefined;

      if (blueData?.endOri && redData?.endOri) {
        return {
          blueOri: blueData.endOri as string,
          redOri: redData.endOri as string,
        };
      }
      return null;
    }

    const blueMotion = motions.blue as Record<string, unknown> | undefined;
    const redMotion = motions.red as Record<string, unknown> | undefined;

    if (!blueMotion?.endOri || !redMotion?.endOri) {
      return null;
    }

    return {
      blueOri: blueMotion.endOri as string,
      redOri: redMotion.endOri as string,
    };
  }

  /**
   * Calculate how many steps an orientation needs to return to its original.
   * Orientations cycle: in → clock → out → counter → in (4 states)
   */
  calculateOrientationSteps(startOri: string, endOri: string): 1 | 2 | 4 {
    if (startOri === endOri) return 1;

    // Define the orientation cycle
    const cycle = ["in", "clock", "out", "counter"];
    const startIdx = cycle.indexOf(startOri);
    const endIdx = cycle.indexOf(endOri);

    // If either orientation isn't in the cycle, assume they match (conservative)
    if (startIdx === -1 || endIdx === -1) return 1;

    const diff = (endIdx - startIdx + 4) % 4;

    // diff === 0: same orientation (1 repetition)
    // diff === 2: opposite orientation (2 repetitions to flip back)
    // diff === 1 or 3: quarter-step (4 repetitions)
    if (diff === 0) return 1;
    if (diff === 2) return 2;
    return 4;
  }

  /**
   * Calculate orientation alignment between sequence start and a potential end position.
   */
  calculateOrientationAlignment(
    sequence: SequenceData,
    bridgePictograph: PictographData
  ): OrientationAlignment | null {
    // Get start orientations
    const startOris = this.getStartOrientations(sequence);
    if (!startOris) return null;

    // Get end orientations from bridge pictograph
    const blueMotion = bridgePictograph.motions?.blue;
    const redMotion = bridgePictograph.motions?.red;

    if (!blueMotion?.endOrientation || !redMotion?.endOrientation) return null;

    const blueEndOri = blueMotion.endOrientation;
    const redEndOri = redMotion.endOrientation;

    // Calculate steps needed for each prop
    const blueSteps = this.calculateOrientationSteps(
      startOris.blueOri,
      blueEndOri
    );
    const redSteps = this.calculateOrientationSteps(
      startOris.redOri,
      redEndOri
    );

    // Need LCM of both steps (if blue needs 2 and red needs 4, we need 4 total)
    const repetitionsNeeded = Math.max(blueSteps, redSteps) as 1 | 2 | 4;

    return {
      matches:
        blueEndOri === startOris.blueOri && redEndOri === startOris.redOri,
      blueEndOri,
      redEndOri,
      blueStartOri: startOris.blueOri,
      redStartOri: startOris.redOri,
      repetitionsNeeded,
    };
  }

  /**
   * Calculate the resulting sequence length after applying a LOOP.
   */
  calculateResultingLength(
    currentLength: number,
    rotationRelation: "exact" | "half" | "quarter" | null,
    repetitionsNeeded: 1 | 2 | 4 = 1
  ): number {
    // Add 1 for the bridge letter itself
    const withBridge = currentLength + 1;

    switch (rotationRelation) {
      case "half":
        // 180° rotation = 2x sequence length
        return withBridge * 2;
      case "quarter":
        // 90° rotation = 4x sequence length
        return withBridge * 4;
      case "exact":
        // Exact position = multiply by repetitions needed for orientation alignment
        return withBridge * repetitionsNeeded;
      default:
        return withBridge;
    }
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
export const orientationAlignmentCalculator = new OrientationAlignmentCalculator();
