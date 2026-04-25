/**
 * Sequence Validation Service
 *
 * Pure validation logic for sequences and steps.
 * All functions are pure - return validation results without side effects.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StepData } from "../../domain/models/StepData";
import type { ValidationResult } from "../../../../../shared/validation/ValidationResult";
import type { ISequenceValidator } from "../contracts/ISequenceValidator";

export class SequenceValidator implements ISequenceValidator {
  /**
   * Validate a complete sequence
   */
  validateSequence(sequence: SequenceData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Name validation
    if (!sequence.name.trim()) {
      errors.push("Sequence name is required");
    }

    // Length validation
    if (sequence.steps.length === 0) {
      warnings.push("Sequence has no steps");
    }

    if (sequence.steps.length > 64) {
      errors.push("Sequence cannot have more than 64 steps");
    }

    // Beat validation
    sequence.steps.forEach((step, index) => {
      const beatErrors = this.validateStep(step, index);
      errors.push(...beatErrors);
    });

    return {
      isValid: errors.length === 0,
      errors: errors.map((err) => ({
        code: "VALIDATION_ERROR",
        message: err,
        severity: "error" as const,
      })),
      warnings: warnings.map((warn) => ({
        code: "VALIDATION_WARNING",
        message: warn,
      })),
    };
  }

  /**
   * Validate a single beat
   */
  validateStep(beat: StepData, expectedStepNumber: number): string[] {
    const errors: string[] = [];

    if (beat.stepNumber !== expectedStepNumber + 1) {
      errors.push(
        `Beat ${expectedStepNumber + 1} has incorrect beat number: ${beat.stepNumber}`
      );
    }

    if (beat.duration <= 0) {
      errors.push(
        `Beat ${expectedStepNumber + 1} has invalid duration: ${beat.duration}`
      );
    }

    return errors;
  }

  /**
   * Validate beat index is within bounds
   */
  isValidStepIndex(sequence: SequenceData | null, stepIndex: number): boolean {
    if (!sequence) return false;
    return stepIndex >= 0 && stepIndex < sequence.steps.length;
  }

  /**
   * Validate sequence name
   */
  validateSequenceName(name: string): { isValid: boolean; error?: string } {
    if (!name.trim()) {
      return { isValid: false, error: "Sequence name is required" };
    }
    return { isValid: true };
  }

  /**
   * Validate sequence length
   */
  validateSequenceLength(length: number): { isValid: boolean; error?: string } {
    if (length < 1 || length > 64) {
      return {
        isValid: false,
        error: "Sequence length must be between 1 and 64 steps",
      };
    }
    return { isValid: true };
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
export const sequenceValidator = new SequenceValidator();
