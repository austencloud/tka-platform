import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export interface ISequenceIndexer {
  loadSequenceIndex(): Promise<SequenceData[]>;
  buildSearchIndex(sequences: SequenceData[]): Promise<void>;
  searchSequences(query: string): Promise<SequenceData[]>;
  refreshIndex(): Promise<void>;
}
