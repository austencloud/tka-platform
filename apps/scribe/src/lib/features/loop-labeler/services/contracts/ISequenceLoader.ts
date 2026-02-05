import type { SequenceEntry } from "./IStepDataConverter";
import type { LabeledSequence } from "./ILOOPLabelsFirebaseRepository";

/**
 * Filter mode for sequences
 */
export type FilterMode = "all" | "needsVerification" | "verified";

/**
 * Sequence statistics
 */
export interface SequenceStats {
  total: number;
  needsVerification: number;
  verified: number;
}

/**
 * Service for loading and filtering sequences
 */
export interface ISequenceLoader {
  /**
   * Load all sequences from sequence-index.json
   */
  loadSequences(): Promise<SequenceEntry[]>;

  /**
   * Filter sequences based on labeling status
   */
  filterSequences(
    sequences: SequenceEntry[],
    labels: Map<string, LabeledSequence>,
    filterMode: FilterMode
  ): SequenceEntry[];

  /**
   * Calculate statistics for sequences and labels
   */
  calculateStats(
    sequences: SequenceEntry[],
    labels: Map<string, LabeledSequence>
  ): SequenceStats;
}
