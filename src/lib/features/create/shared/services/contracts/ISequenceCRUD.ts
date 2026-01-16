/**
 * Interface for sequence CRUD operations (Create, Read, Update, Delete)
 */
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StepData } from "../../domain/models/StepData";
import type { SequenceCreateRequest } from "../../domain/models/sequence-models";

export interface ISequenceCRUD {
  /**
   * Create a new sequence
   */
  createSequence(request: SequenceCreateRequest): Promise<SequenceData>;

  /**
   * Update an entire sequence
   */
  updateSequence(sequence: SequenceData): Promise<SequenceData>;

  /**
   * Delete a sequence by ID
   */
  deleteSequence(id: string): Promise<void>;

  /**
   * Update a specific beat in a sequence
   */
  updateStep(
    sequenceId: string,
    stepIndex: number,
    beat: StepData
  ): Promise<void>;

  /**
   * Add a beat to a sequence
   */
  addStep(sequenceId: string, beat: StepData): Promise<void>;

  /**
   * Remove a beat from a sequence
   */
  removeStep(sequenceId: string, stepIndex: number): Promise<void>;

  /**
   * Load all sequences
   */
  loadAllSequences(): Promise<SequenceData[]>;

  /**
   * Duplicate a sequence
   */
  duplicateSequence(sequence: SequenceData): Promise<SequenceData>;
}
