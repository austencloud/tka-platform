import type { LabeledSequence } from "./ILOOPLabelsFirebaseRepository";

/**
 * Service for navigation and utility functions
 */
export interface INavigator {
  /**
   * Get the next index in a circular fashion
   */
  getNextIndex(currentIndex: number, totalSequences: number): number;

  /**
   * Get the previous index
   */
  getPreviousIndex(currentIndex: number): number;

  /**
   * Update URL with current sequence ID and optionally filter mode
   * @param addToHistory - If true, uses pushState (enables back button). If false, uses replaceState.
   */
  updateUrlWithSequence(
    sequenceId: string | null,
    filterMode?: string,
    addToHistory?: boolean
  ): void;

  /**
   * Get sequence ID from URL
   */
  getSequenceFromUrl(): string | null;

  /**
   * Get filter mode from URL
   */
  getFilterFromUrl(): string | null;

  /**
   * Update URL with filter mode
   */
  updateUrlWithFilter(filterMode: string): void;

  /**
   * Export labels as JSON file
   */
  exportLabelsAsJson(labels: Map<string, LabeledSequence>): void;

  /**
   * Import labels from JSON file
   */
  importLabelsFromJson(file: File): Promise<Map<string, LabeledSequence>>;
}
