import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import type { SequenceData } from "../../domain/models/SequenceData";

export class WordDeriver {
  deriveFromBeats(steps: readonly StepData[]): string {
    if (!steps || steps.length === 0) return "";

    return steps
      .map((step) => step.letter ?? "")
      .filter((letter) => letter !== "")
      .join("");
  }

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
   * Priority: displayName > intendedWord > word > name > id
   */
  getDisplayName(sequence: SequenceData): string {
    if (sequence.displayName) return sequence.displayName;
    if (sequence.intendedWord) return sequence.intendedWord;
    return this.derive(sequence) || sequence.name || sequence.id;
  }
}
