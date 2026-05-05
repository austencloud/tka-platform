import type { LibrarySequence } from "$lib/shared/library/domain/models/LibrarySequence";

export interface IPublicIndexSyncer {
  syncToPublicIndex(sequence: LibrarySequence, userId: string): Promise<void>;
  removeFromPublicIndex(sequenceId: string): Promise<void>;
}
