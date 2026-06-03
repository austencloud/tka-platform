import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { SequenceData } from "../domain/models/sequence-data";

export function deriveWordFromBeats(steps: readonly StepData[]): string {
  if (!steps || steps.length === 0) return "";

  return steps
    .map((step) => step.letter ?? "")
    .filter((letter) => letter !== "")
    .join("");
}

export function deriveWord(sequence: SequenceData): string {
  // First try to derive from steps (single source of truth when hydrated)
  if (sequence.steps && sequence.steps.length > 0) {
    const derived = deriveWordFromBeats(sequence.steps);
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
export function getSequenceDisplayName(sequence: SequenceData): string {
  if (sequence.displayName) return sequence.displayName;
  if (sequence.intendedWord) return sequence.intendedWord;
  return deriveWord(sequence) || sequence.name || sequence.id;
}
