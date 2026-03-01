import type { SequenceEntry, RawStepData } from "./IStepDataConverter";
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
   * Load all sequences from publicSequences index
   */
  loadSequences(): Promise<SequenceEntry[]>;

  /**
   * Fetch full sequence data (steps, motions) from the source library document.
   * Returns RawStepData[] in the format expected by the detection pipeline,
   * or null if the source document doesn't exist.
   */
  loadSequenceDetail(sourceRef: string): Promise<RawStepData[] | null>;

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
