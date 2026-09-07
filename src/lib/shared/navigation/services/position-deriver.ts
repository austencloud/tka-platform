/**
 * Position Deriver Service Implementation
 *
 * Derives start/end positions from motion data for deep link sequences.
 * Uses grid position deriver to calculate positions based on hand locations.
 *
 * Domain: Navigation - Position Derivation
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/start-position-data";
import { getGridPositionFromLocations } from "$lib/shared/pictograph/grid/services/grid-position-deriver";
import type { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

export async function derivePositionsForSequence(
  sequence: SequenceData
): Promise<SequenceData> {
  // Derive positions for all steps in the sequence
  const beatsWithPositions = sequence.steps.map((step) =>
    derivePositionsForBeat(step)
  ) as StepData[];

  // Derive positions for start position if it exists
  let updatedStartPosition: StartPositionData | null | undefined =
    sequence.startPosition;
  let updatedStartingPositionStep: StartPositionData | undefined =
    sequence.startingPosition;

  if (sequence.startPosition) {
    // Cast is safe - we pass StartPositionData so we get StartPositionData back
    updatedStartPosition = derivePositionsForBeat(
      sequence.startPosition
    ) as StartPositionData;
  }

  if (sequence.startingPosition) {
    // Cast is safe - we pass StartPositionData so we get StartPositionData back
    updatedStartingPositionStep = derivePositionsForBeat(
      sequence.startingPosition
    ) as StartPositionData;
  }

  return {
    ...sequence,
    steps: beatsWithPositions,
    ...(updatedStartPosition !== undefined &&
      updatedStartPosition !== null && {
        startPosition: updatedStartPosition,
      }),
    ...(updatedStartingPositionStep !== undefined && {
      startingPosition: updatedStartingPositionStep,
    }),
  };
}

function derivePositionsForBeat(
  beat: StepData | StartPositionData
): StepData | StartPositionData {
  // Skip if positions are already set or if motions are missing
  if (
    (beat.startPosition !== null && beat.endPosition !== null) ||
    !beat.motions.left ||
    !beat.motions.right
  ) {
    return beat;
  }

  try {
    // Calculate start position from starting hand locations
    const startPosition: GridPosition = getGridPositionFromLocations(
      beat.motions.left.startLocation,
      beat.motions.right.startLocation
    );

    // Calculate end position from ending hand locations
    const endPosition: GridPosition = getGridPositionFromLocations(
      beat.motions.left.endLocation,
      beat.motions.right.endLocation
    );

    return {
      ...beat,
      startPosition,
      endPosition,
    };
  } catch (error) {
    // Use appropriate identifier in warning
    const identifier =
      "stepNumber" in beat ? `beat ${beat.stepNumber}` : "start position";
    console.warn(`Failed to derive positions for ${identifier}:`, error);
    return beat;
  }
}
