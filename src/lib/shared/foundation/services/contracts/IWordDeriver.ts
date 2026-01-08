/**
 * Word Deriver Contract
 *
 * Derives the TKA word from a sequence's beats.
 * The word is NOT stored data - it's derived from the sequence's letters.
 * This is the single source of truth for what "word" a sequence represents.
 */

import type { BeatData } from "$lib/features/create/shared/domain/models/BeatData";
import type { SequenceData } from "../../domain/models/SequenceData";

export interface IWordDeriver {
  /**
   * Derive the word from a sequence's beats
   * Returns empty string if no beats or no letters found
   */
  deriveFromBeats(beats: readonly BeatData[]): string;

  /**
   * Derive the word from a SequenceData object
   * Prefers derived word from beats, falls back to stored word/name
   */
  derive(sequence: SequenceData): string;

  /**
   * Get the display name for a sequence
   * Prefers displayName > derived word > name > id
   */
  getDisplayName(sequence: SequenceData): string;
}
