/**
 * Sequence Index Service Contract
 *
 * Interface for sequence indexing and search functionality.
 * Based on the existing ISequenceIndexer from browse/Browse.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export interface ISequenceIndexer {
  // Core indexing operations
  buildIndex(sequences: SequenceData[]): void;
  loadSequenceIndex(): Promise<SequenceData[]>;
  refreshIndex(): Promise<void>;

  // Search operations
  searchSequences(query: string): SequenceData[];
  getSequencesByTag(tag: string): SequenceData[];
  getSuggestions(partialQuery: string, maxSuggestions?: number): string[];

  // Index management
  updateIndex(sequence: SequenceData): void;
  removeFromIndex(sequenceId: string): void;

  // Utility operations
  getSequenceById(id: string): Promise<SequenceData | null>;
  getIndexStats(): {
    totalSequences: number;
    indexedWords: number;
    indexedAuthors: number;
    indexedTags: number;
    indexedMetadata: number;
  };
}
