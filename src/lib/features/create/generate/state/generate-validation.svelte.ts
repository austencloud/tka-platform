/**
 * Generation Validation State - Reactive validation for generation configuration
 *
 * Provides real-time validation of generation settings before orchestration.
 * Prevents invalid configurations from reaching the generation pipeline.
 */

import { DifficultyLevel } from "../shared/domain/models/generate-models";
import type { UIGenerationConfig } from "./generate-config.svelte";

export interface ValidationError {
  field: keyof UIGenerationConfig;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

/**
 * Validation rules for generation configuration
 */
const VALIDATION_RULES = {
  length: {
    min: 1,
    max: 64,
    recommended: { min: 4, max: 32 },
  },
  turnIntensity: {
    beginner: { min: 1, max: 3 },
    intermediate: { min: 1, max: 5 },
    advanced: { min: 1, max: 7 },
  },
} as const;

/**
 * Create validation state for generation configuration
 */
export function createGenerationValidationState() {
  let validationErrors = $state<ValidationError[]>([]);
  let validationWarnings = $state<ValidationError[]>([]);
  let lastValidatedConfig = $state<UIGenerationConfig | null>(null);

  /**
   * Validate complete generation configuration
   */
  function validateConfig(config: UIGenerationConfig): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Validate length
    const lengthValidation = validateLength(config.length);
    errors.push(...lengthValidation.errors);
    warnings.push(...lengthValidation.warnings);

    // Validate turn intensity for level
    const turnValidation = validateTurnIntensity(
      config.turnIntensity,
      config.level
    );
    errors.push(...turnValidation.errors);
    warnings.push(...turnValidation.warnings);

    // Validate LOOP configuration (when LOOP is enabled)
    if (config.loopEnabled) {
      const loopValidation = validateLOOPConfiguration(config);
      errors.push(...loopValidation.errors);
      warnings.push(...loopValidation.warnings);
    }

    // Update reactive state
    validationErrors = errors;
    validationWarnings = warnings;
    lastValidatedConfig = config;

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate sequence length
   */
  function validateLength(length: number): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    if (length < VALIDATION_RULES.length.min) {
      errors.push({
        field: "length",
        message: `Length must be at least ${VALIDATION_RULES.length.min}`,
        severity: "error",
      });
    }

    if (length > VALIDATION_RULES.length.max) {
      errors.push({
        field: "length",
        message: `Length cannot exceed ${VALIDATION_RULES.length.max}`,
        severity: "error",
      });
    }

    // Warnings for non-optimal lengths
    if (
      length < VALIDATION_RULES.length.recommended.min &&
      length >= VALIDATION_RULES.length.min
    ) {
      warnings.push({
        field: "length",
        message: `Sequences shorter than ${VALIDATION_RULES.length.recommended.min} may lack complexity`,
        severity: "warning",
      });
    }

    if (
      length > VALIDATION_RULES.length.recommended.max &&
      length <= VALIDATION_RULES.length.max
    ) {
      warnings.push({
        field: "length",
        message: `Sequences longer than ${VALIDATION_RULES.length.recommended.max} may be difficult to perform`,
        severity: "warning",
      });
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate turn intensity for difficulty level
   */
  function validateTurnIntensity(
    intensity: number,
    level: number
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Map level number to difficulty
    const difficulty: DifficultyLevel =
      level === 1
        ? DifficultyLevel.BEGINNER
        : level === 2
          ? DifficultyLevel.INTERMEDIATE
          : DifficultyLevel.ADVANCED;

    const rules = VALIDATION_RULES.turnIntensity[difficulty];

    if (intensity < rules.min) {
      errors.push({
        field: "turnIntensity",
        message: `Turn intensity must be at least ${rules.min} for ${difficulty} level`,
        severity: "error",
      });
    }

    if (intensity > rules.max) {
      errors.push({
        field: "turnIntensity",
        message: `Turn intensity cannot exceed ${rules.max} for ${difficulty} level`,
        severity: "error",
      });
    }

    // Warning if intensity seems too high for level
    if (difficulty === "beginner" && intensity > 2) {
      warnings.push({
        field: "turnIntensity",
        message: "High turn intensity may be challenging for beginners",
        severity: "warning",
      });
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate LOOP configuration for circular mode
   */
  function validateLOOPConfiguration(
    config: UIGenerationConfig
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // LOOP type must be selected
    if (!config.loopType) {
      errors.push({
        field: "loopType",
        message: "LOOP type must be selected for circular mode",
        severity: "error",
      });
    }

    // Slice size must be selected
    if (!config.sliceSize) {
      errors.push({
        field: "sliceSize",
        message: "Slice size must be selected for circular mode",
        severity: "error",
      });
    }

    // Warn about complex LOOP types for beginners
    if (
      config.level === 1 &&
      config.loopType?.includes("INVERTED")
    ) {
      warnings.push({
        field: "loopType",
        message: "Inverted LOOP types may be challenging for beginners",
        severity: "warning",
      });
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Clear all validation errors and warnings
   */
  function clearValidation() {
    validationErrors = [];
    validationWarnings = [];
    lastValidatedConfig = null;
  }

  /**
   * Get validation errors for a specific field
   */
  function getFieldErrors(field: keyof UIGenerationConfig): ValidationError[] {
    return validationErrors.filter((error) => error.field === field);
  }

  /**
   * Get validation warnings for a specific field
   */
  function getFieldWarnings(
    field: keyof UIGenerationConfig
  ): ValidationError[] {
    return validationWarnings.filter((warning) => warning.field === field);
  }

  /**
   * Check if a specific field has errors
   */
  function hasFieldErrors(field: keyof UIGenerationConfig): boolean {
    return validationErrors.some((error) => error.field === field);
  }

  return {
    // Reactive state
    get errors() {
      return validationErrors;
    },
    get warnings() {
      return validationWarnings;
    },
    get hasErrors() {
      return validationErrors.length > 0;
    },
    get hasWarnings() {
      return validationWarnings.length > 0;
    },
    get lastValidated() {
      return lastValidatedConfig;
    },

    // Validation methods
    validateConfig,
    validateLength,
    validateTurnIntensity,
    validateLOOPConfiguration,
    clearValidation,
    getFieldErrors,
    getFieldWarnings,
    hasFieldErrors,
  };
}

/**
 * Type guard for validation errors
 */
export function isValidationError(error: unknown): error is ValidationError {
  return (
    typeof error === "object" &&
    error !== null &&
    "field" in error &&
    "message" in error &&
    "severity" in error
  );
}
