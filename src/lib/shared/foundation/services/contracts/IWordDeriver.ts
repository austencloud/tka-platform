/**
 * Word Deriver Contract
 *
 * Derives the TKA word from a sequence's steps.
 * The word is NOT stored data - it's derived from the sequence's letters.
 * This is the single source of truth for what "word" a sequence represents.
 */

import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import type { SequenceData } from "../../domain/models/SequenceData";

export interface IWordDeriver {
  /**
   * Derive the word from a sequence's steps
   * Returns empty string if no steps or no letters found
   */
  deriveFromBeats(steps: readonly StepData[]): string;

  /**
   * Derive the word from a SequenceData object
   * Prefers derived word from steps, falls back to stored word/name
   */
  derive(sequence: SequenceData): string;

  /**
   * Get the display name for a sequence
   * Priority: displayName > intendedWord > word > name > id
   *
   * - displayName: User's explicit custom name (e.g., "My Fire Routine")
   * - intendedWord: What user typed before bridges (e.g., "CAKE")
   * - word: Expanded TKA letters with bridges (e.g., "CABΔKE")
   */
  getDisplayName(sequence: SequenceData): string;
}
