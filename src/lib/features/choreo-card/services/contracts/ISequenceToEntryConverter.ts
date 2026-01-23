/**
 * Contract for converting SequenceData (library format) to SequenceEntry (LOOP detector format)
 */
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { SequenceEntry } from "$lib/features/loop-labeler/domain/models/sequence-models";

export interface ISequenceToEntryConverter {
  /**
   * Convert a SequenceData (from library/Firebase) to SequenceEntry (for LOOP detection)
   */
  convert(sequence: SequenceData): SequenceEntry;
}
