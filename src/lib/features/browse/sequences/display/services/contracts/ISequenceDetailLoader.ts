/**
 * ISequenceDetailLoader - Load full sequence data for detail views
 *
 * Handles lazy-loading of complete sequence data (including steps)
 * when viewing sequence details. Wraps the underlying PublicSequencesLoader
 * with additional caching and state management.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export interface SequenceLoadResult {
  sequence: SequenceData | null;
  isLoading: boolean;
  error: Error | null;
}

export interface ISequenceDetailLoader {
  /**
   * Load full sequence data for a sequence.
   * If the sequence already has steps, returns it directly.
   * Otherwise fetches from the browse loader.
   *
   * @param sequence - The sequence to load full data for
   * @returns The complete sequence with steps, or null if loading failed
   */
  loadFullSequence(sequence: SequenceData): Promise<SequenceData | null>;

  /**
   * Check if a sequence needs full data loading
   * (i.e., doesn't have steps yet)
   */
  needsFullLoad(sequence: SequenceData): boolean;
}
