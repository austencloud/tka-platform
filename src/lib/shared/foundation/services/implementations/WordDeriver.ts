/**
 * Word Deriver Implementation
 *
 * Derives the TKA word from a sequence's beats.
 * Each beat has a letter (from the kinetic alphabet), and the word is simply
 * the concatenation of all beat letters in order.
 */

import { injectable } from "inversify";
import type { BeatData } from "$lib/features/create/shared/domain/models/BeatData";
import type { SequenceData } from "../../domain/models/SequenceData";
import type { IWordDeriver } from "../contracts/IWordDeriver";

@injectable()
export class WordDeriver implements IWordDeriver {
  /**
   * Derive the word from a sequence's beats
   * Returns empty string if no beats or no letters found
   */
  deriveFromBeats(beats: readonly BeatData[]): string {
    if (!beats || beats.length === 0) return "";

    return beats
      .map((beat) => beat.letter ?? "")
      .filter((letter) => letter !== "")
      .join("");
  }

  /**
   * Derive the word from a SequenceData object
   * Prefers derived word from beats, falls back to stored word/name
   */
  derive(sequence: SequenceData): string {
    // First try to derive from beats (single source of truth)
    if (sequence.beats && sequence.beats.length > 0) {
      const derived = this.deriveFromBeats(sequence.beats);
      if (derived) return derived;
    }

    // Fallback to stored word or name (for sequences without loaded beats)
    // This handles the case where we only have metadata without full beat data
    return sequence.word || sequence.name || "";
  }

  /**
   * Get the display name for a sequence
   * Prefers displayName > derived word > name > id
   */
  getDisplayName(sequence: SequenceData): string {
    if (sequence.displayName) return sequence.displayName;
    return this.derive(sequence) || sequence.name || sequence.id;
  }
}
