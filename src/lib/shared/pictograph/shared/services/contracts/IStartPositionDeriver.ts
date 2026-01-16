/**
 * Start Position Deriver Interface
 *
 * Derives/reconstructs start position data from the first beat of a sequence.
 * Used when sequences don't have explicit start position data stored.
 */

import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export interface IStartPositionDeriver {
  /**
   * Derive start position from the first beat of a sequence.
   * Reconstructs the start position by looking at where each motion STARTS
   * (the startLocation and startOrientation of blue/red motions).
   *
   * @param firstStep - The first beat of the sequence
   * @returns StartPositionData with static motions at the starting locations
   */
  deriveFromFirstBeat(firstStep: StepData): StartPositionData;

  /**
   * Get the start position for a sequence, deriving it if not present.
   * Checks startPosition and startingPosition first, then derives from first beat.
   *
   * @param sequence - The sequence to get start position for
   * @returns StartPositionData or null if cannot be determined
   */
  getOrDeriveStartPosition(
    sequence: SequenceData
  ): StartPositionData | StepData | null;
}
