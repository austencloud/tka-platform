/**
 * Sequence Validation Service Interface
 *
 * Pure validation logic for sequences and steps.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StepData } from "../../domain/models/StepData";
import type { ValidationResult } from "../../../../../shared/validation/ValidationResult";

export interface ISequenceValidator {
  /**
   * Validate a complete sequence
   */
  validateSequence(sequence: SequenceData): ValidationResult;

  /**
   * Validate a single beat
   */
  validateStep(beat: StepData, expectedStepNumber: number): string[];

  /**
   * Validate beat index is within bounds
   */
  isValidStepIndex(sequence: SequenceData | null, stepIndex: number): boolean;

  /**
   * Validate sequence name
   */
  validateSequenceName(name: string): { isValid: boolean; error?: string };

  /**
   * Validate sequence length
   */
  validateSequenceLength(length: number): { isValid: boolean; error?: string };
}
