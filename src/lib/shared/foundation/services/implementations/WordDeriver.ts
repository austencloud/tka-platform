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
      .map((step) => step.letter ?? "")
      .filter((letter) => letter !== "")
      .join("");
  }

  /**
   * Derive the word from a SequenceData object
   * Prefers derived word from steps, falls back to stepPairings (for documents
   * where steps haven't been hydrated yet), then stored word/name.
   */
  derive(sequence: SequenceData): string {
    // First try to derive from steps (single source of truth when hydrated)
    if (sequence.steps && sequence.steps.length > 0) {
      const derived = this.deriveFromBeats(sequence.steps);
      if (derived) return derived;
    }

    // Steps aren't persisted to Firestore - they're derived at load time by the
    // hydrator. If hydration hasn't run yet, stepPairings still has the letters.
    if (sequence.stepPairings && sequence.stepPairings.length > 0) {
      const derived = sequence.stepPairings
        .map((p) => p.letter ?? "")
        .filter((l) => l !== "")
        .join("");
      if (derived) return derived;
    }

    // Fallback to stored word or name (for sequences without loaded steps)
    return sequence.word || sequence.name || "";
  }

  /**
   * Get the display name for a sequence
   * Priority: displayName > intendedWord > word > name > id
   *
   * - displayName: User's explicit custom name (e.g., "My Fire Routine")
   * - intendedWord: What user typed before bridges (e.g., "CAKE")
   * - word: Expanded TKA letters with bridges (e.g., "CABΔKE")
   */
  getDisplayName(sequence: SequenceData): string {
    if (sequence.displayName) return sequence.displayName;
    if (sequence.intendedWord) return sequence.intendedWord;
    return this.derive(sequence) || sequence.name || sequence.id;
  }
}
