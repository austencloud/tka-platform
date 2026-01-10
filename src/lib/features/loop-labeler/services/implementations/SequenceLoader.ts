import type { SequenceEntry } from "../contracts/IBeatDataConverter";
import type { LabeledSequence } from "../contracts/ILOOPLabelsFirebaseRepository";
import type {
  ISequenceLoader,
  FilterMode,
  SequenceStats,
} from "../contracts/ISequenceLoader";

/**
 * Service for loading and filtering sequences
 */
export class SequenceLoader implements ISequenceLoader {
  async loadSequences(): Promise<SequenceEntry[]> {
    try {
      const response = await fetch("/data/sequence-index.json");
      const data = await response.json();
      return data.sequences || [];
    } catch (error) {
      console.error("Failed to load sequences:", error);
      return [];
    }
  }

  filterSequences(
    sequences: SequenceEntry[],
    labels: Map<string, LabeledSequence>,
    filterMode: FilterMode
  ): SequenceEntry[] {
    // First filter to only circular sequences
    const circularSequences = sequences.filter((s) => s.isCircular);

    // Apply filter mode
    switch (filterMode) {
      case "needsVerification":
        return circularSequences.filter(
          (s) => labels.get(s.word)?.needsVerification === true
        );

      case "verified":
        return circularSequences.filter((s) => {
          const label = labels.get(s.word);
          return label && !label.needsVerification;
        });

      default:
        return circularSequences;
    }
  }

  calculateStats(
    sequences: SequenceEntry[],
    labels: Map<string, LabeledSequence>
  ): SequenceStats {
    const circularSequences = sequences.filter((s) => s.isCircular);
    const total = circularSequences.length;

    const needsVerification = Array.from(labels.values()).filter(
      (l) => l.needsVerification === true
    ).length;

    const verified = labels.size - needsVerification;

    return {
      total,
      needsVerification,
      verified,
    };
  }
}
