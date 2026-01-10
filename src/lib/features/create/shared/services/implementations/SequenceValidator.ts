/**
 * Sequence Validation Service
 *
 * Pure validation logic for sequences and beats.
 * All functions are pure - return validation results without side effects.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { BeatData } from "../../domain/models/BeatData";
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
    if (sequence.beats.length === 0) {
      warnings.push("Sequence has no beats");
    }

    if (sequence.beats.length > 64) {
      errors.push("Sequence cannot have more than 64 beats");
    }

    // Beat validation
    sequence.beats.forEach((beat, index) => {
      const beatErrors = this.validateBeat(beat, index);
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
  validateBeat(beat: BeatData, expectedBeatNumber: number): string[] {
    const errors: string[] = [];

    if (beat.beatNumber !== expectedBeatNumber + 1) {
      errors.push(
        `Beat ${expectedBeatNumber + 1} has incorrect beat number: ${beat.beatNumber}`
      );
    }

    if (beat.duration <= 0) {
      errors.push(
        `Beat ${expectedBeatNumber + 1} has invalid duration: ${beat.duration}`
      );
    }

    return errors;
  }

  /**
   * Validate beat index is within bounds
   */
  isValidBeatIndex(sequence: SequenceData | null, beatIndex: number): boolean {
    if (!sequence) return false;
    return beatIndex >= 0 && beatIndex < sequence.beats.length;
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
        error: "Sequence length must be between 1 and 64 beats",
      };
    }
    return { isValid: true };
  }
}
