/**
 * Sequence Normalization Service
 *
 * Handles normalization of sequence data for consistent consumption by UI components.
 * Always returns StartPositionData (never StepData) for start positions.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/start-position-data";

export interface NormalizedSequenceData {
  /**
   * Steps array with stepNumber >= 1 (excludes start position)
   */
  steps: readonly StepData[];

  /**
   * Start position (always StartPositionData, never StepData)
   */
  startPosition: StartPositionData | null;
}
import { createStartPositionData } from "$lib/shared/create/factories/create-start-position-data";

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
export function separateStepsFromStartPosition(
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
    ? convertStepToStartPosition(legacyStartPos)
    : null;

  return {
    steps,
    startPosition,
  };
}

/**
 * Convert legacy StepData (stepNumber: 0) to proper StartPositionData
 */
function convertStepToStartPosition(step: StepData): StartPositionData {
  return createStartPositionData({
    id: step.id || `start-${Date.now()}`,
    letter: step.letter ?? null,
    gridPosition: step.endPosition ?? step.startPosition ?? null,
    motions: step.motions,
  });
}
