import type {
  DeleteConfirmationData,
  DeleteResult,
} from "../../../../create/shared/domain/models/sequence-models";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export interface IBrowseDeleter {
  /** Prepare deletion data for confirmation dialog */
  prepareDeleteConfirmation(
    sequence: SequenceData,
    allSequences: SequenceData[]
  ): DeleteConfirmationData;

  /** Delete sequence and handle cleanup */
  deleteSequence(
    sequenceId: string,
    allSequences: SequenceData[]
  ): DeleteResult;

  /** Fix variation numbers after deletion */
  fixVariationNumbers(
    deletedSequence: SequenceData,
    allSequences: SequenceData[]
  ): SequenceData[];

  /** Check if sequence can be safely deleted */
  canDeleteSequence(
    sequence: SequenceData,
    allSequences: SequenceData[]
  ): boolean;

  /** Get sequences that would be affected by deletion */
  getAffectedSequences(
    sequence: SequenceData,
    allSequences: SequenceData[]
  ): SequenceData[];
}
