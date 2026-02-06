/**
 * Sequence Normalizer Interface
 *
 * Handles normalization of sequence data for consistent consumption by UI components.
 * Specifically handles the separation of beat 0 (start position) from the steps array.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StartPositionData } from "../../../create/shared/domain/models/StartPositionData";
import type { StepData } from "../../../create/shared/domain/models/StepData";

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

export interface ISequenceNormalizer {
  /**
   * Normalize sequence data by separating start position from steps array.
   * Some sequences have startPosition as a separate field, others have it mixed
   * in the steps array as stepNumber 0.
   *
   * This ensures consistent data structure for components like StepGrid.
   *
   * @param sequence The sequence to normalize
   * @returns Normalized data with steps and startPosition separated
   */
  separateStepsFromStartPosition(
    sequence: SequenceData
  ): NormalizedSequenceData;
}
