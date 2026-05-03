/**
 * Sequence Normalization Service
 *
 * Handles normalization of sequence data for consistent consumption by UI components.
 * Always returns StartPositionData (never StepData) for start positions.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { NormalizedSequenceData } from "../contracts/types";
import type { StepData } from "../../../create/shared/domain/models/StepData";
import type { StartPositionData } from "../../../create/shared/domain/models/StartPositionData";
import { createStartPositionData } from "../../../create/shared/domain/factories/createStartPositionData";

export class SequenceNormalizer {
  /**
   * Normalize sequence data by separating start position from steps array.
   *
   * Handles three storage patterns:
   * 1. startPosition field (modern, uses StartPositionData)
   * 2. startingPosition field (legacy, may need conversion)
   * 3. Mixed in steps array (oldest, stepNumber: 0)
   *
   * Always returns StartPositionData, converting legacy StepData if needed.
   */
  separateStepsFromStartPosition(
    sequence: SequenceData
  ): NormalizedSequenceData {
    // Pattern 1: Modern approach - separate startPosition field (already StartPositionData)
    if (sequence.startPosition) {
      return {
        steps: sequence.steps || [],
        startPosition: sequence.startPosition,
      };
    }

    // Pattern 2: Legacy approach - startingPosition field (may need conversion)
    if (sequence.startingPosition) {
      return {
        steps: sequence.steps || [],
        startPosition: sequence.startingPosition,
      };
    }

    // Pattern 3: Oldest approach - beat 0 is mixed in the steps array
    const allSteps = sequence.steps || [];

    // Find legacy start position (stepNumber === 0)
    const legacyStartPos = allSteps.find(
      (step) => step.stepNumber === 0
    ) as StepData | undefined;

    // Filter out start position from steps array (keep only actual steps)
    const steps = allSteps.filter((step) => step.stepNumber !== 0);

    // Convert legacy StepData to StartPositionData if found
    const startPosition: StartPositionData | null = legacyStartPos
      ? this.convertStepToStartPosition(legacyStartPos)
      : null;

    return {
      steps,
      startPosition,
    };
  }

  /**
   * Convert legacy StepData (stepNumber: 0) to proper StartPositionData
   */
  private convertStepToStartPosition(step: StepData): StartPositionData {
    return createStartPositionData({
      id: step.id || `start-${Date.now()}`,
      letter: step.letter ?? null,
      gridPosition: step.endPosition ?? step.startPosition ?? null,
      motions: step.motions,
    });
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
export const sequenceNormalizer = new SequenceNormalizer();
