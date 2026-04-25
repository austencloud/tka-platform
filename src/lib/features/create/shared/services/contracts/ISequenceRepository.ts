/**
 * Sequence Service Contract
 *
 * Core service for sequence CRUD operations
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StepData } from "../../domain/models/StepData";
import type { SequenceCreateRequest } from "../../domain/models/sequence-models";

export interface ISequenceRepository {
  /**
   * Create a new sequence
   * @param request - Sequence creation request
   * @returns Promise resolving to created sequence data
   */
  createSequence(request: SequenceCreateRequest): Promise<SequenceData>;

  /**
   * Update a beat in a sequence
   * @param sequenceId - Sequence identifier
   * @param stepIndex - Beat index to update
   * @param stepData - New step data
   * @returns Promise that resolves when update is complete
   */
  updateStep(
    sequenceId: string,
    stepIndex: number,
    stepData: StepData
  ): Promise<void>;

  /**
   * Get a sequence by ID
   * @param id - Sequence identifier
   * @returns Promise resolving to sequence data or null if not found
   */
  getSequence(id: string): Promise<SequenceData | null>;

  /**
   * Get all sequences
   * @returns Promise resolving to array of all sequences
   */
  getAllSequences(): Promise<SequenceData[]>;

  /**
   * Get all sequences whose blue or red path hash matches the given value.
   * Used to find every sequence that contains a particular hand path.
   * @param pathHash - contentHash of the HandPathData to search for
   * @returns Promise resolving to matching sequences
   */
  getByPathHash(pathHash: string): Promise<SequenceData[]>;

  /**
   * Get all sequences whose blue or red solo prop hash matches the given value.
   * Used to find every sequence that contains a particular solo prop.
   * @param soloHash - contentHash of the SoloPropData to search for
   * @returns Promise resolving to matching sequences
   */
  getBySoloHash(soloHash: string): Promise<SequenceData[]>;
}
