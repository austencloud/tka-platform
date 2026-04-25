/**
 * Sequence Domain Service Contract
 *
 * Service for sequence domain operations and business logic
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StepData } from "../../domain/models/StepData";
import type { SequenceCreateRequest } from "../../domain/models/sequence-models";

export interface ISequenceDomainManager {
  /**
   * Validate a sequence according to business rules
   * @param sequence - Sequence to validate
   * @returns Validation result with errors and warnings
   */
  validateSequence(sequence: SequenceData): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };

  /**
   * Calculate sequence statistics
   * @param sequence - Target sequence
   * @returns Statistics object
   */
  calculateStatistics(sequence: SequenceData): {
    totalSteps: number;
    filledSteps: number;
    emptySteps: number;
    duration: number;
  };

  /**
   * Generate a word from sequence pictograph letters
   * @param sequence - Target sequence
   * @returns Generated word string
   */
  generateWord(sequence: SequenceData): string;

  /**
   * Check if a beat is valid for the sequence
   * @param sequence - Target sequence
   * @param beat - Beat to validate
   * @returns True if beat is valid
   */
  isValidBeat(sequence: SequenceData, beat: StepData): boolean;

  /**
   * Create a new sequence from request
   * @param request - Sequence creation request
   * @returns New sequence data
   */
  createSequence(request: SequenceCreateRequest): SequenceData;

  /**
   * Update a beat in the sequence
   * @param sequence - Target sequence
   * @param stepIndex - Index of beat to update
   * @param stepData - New step data
   * @returns Updated sequence
   */
  updateStep(
    sequence: SequenceData,
    stepIndex: number,
    stepData: StepData
  ): SequenceData;
}
