/**
 * Letter Deriver Service Contract
 *
 * Derives letters from motion data for deep link sequences.
 * Uses motion query handler and grid mode deriver to match
 * motion configurations to their corresponding letters.
 *
 * Domain: Navigation - Letter Derivation
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

/**
 * Service for deriving letters from motion data
 */
export interface ILetterDeriver {
  /**
   * Derive letters for all steps in a sequence using the Motion Query Handler
   * This should be called AFTER loading a deep link sequence to populate the letter fields
   *
   * @param sequence - The sequence with motion data but no letters
   * @returns The same sequence with letters populated
   */
  deriveLettersForSequence(sequence: SequenceData): Promise<SequenceData>;
}
