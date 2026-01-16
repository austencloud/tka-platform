/**
 * Word Deriver Implementation
 *
 * Derives the TKA word from a sequence's steps.
 * Each beat has a letter (from the kinetic alphabet), and the word is simply
 * the concatenation of all beat letters in order.
 */

import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import type { SequenceData } from "../../domain/models/SequenceData";
import type { IWordDeriver } from "../contracts/IWordDeriver";

export class WordDeriver implements IWordDeriver {
  /**
   * Derive the word from a sequence's steps
   * Returns empty string if no steps or no letters found
   */
  deriveFromBeats(steps: readonly StepData[]): string {
    if (!steps || steps.length === 0) return "";

    return steps
      .map((beat) => beat.letter ?? "")
      .filter((letter) => letter !== "")
      .join("");
  }

  /**
   * Derive the word from a SequenceData object
   * Prefers derived word from steps, falls back to stored word/name
   */
  derive(sequence: SequenceData): string {
    // First try to derive from steps (single source of truth)
    if (sequence.steps && sequence.steps.length > 0) {
      const derived = this.deriveFromBeats(sequence.steps);
      if (derived) return derived;
    }

    // Fallback to stored word or name (for sequences without loaded steps)
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
