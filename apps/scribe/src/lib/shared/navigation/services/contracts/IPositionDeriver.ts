/**
 * Position Deriver Service Contract
 *
 * Derives start/end positions from motion data for deep link sequences.
 * Uses grid position deriver to calculate positions based on hand locations.
 *
 * Domain: Navigation - Position Derivation
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

/**
 * Service for deriving positions from motion data
 */
export interface IPositionDeriver {
  /**
   * Derive start and end positions for all steps in a sequence using GridPositionDeriver
   * This should be called AFTER loading a deep link sequence to populate the position fields
   *
   * @param sequence - The sequence with motion data but no positions
   * @returns The same sequence with positions populated
   */
  derivePositionsForSequence(sequence: SequenceData): Promise<SequenceData>;
}
