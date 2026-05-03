/**
 * Orientation Continuity Validator Service Interface
 *
 * Validates beat-to-beat orientation continuity in sequences.
 * Each beat's start orientation must match the previous beat's end orientation.
 */

import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { OrientationCalculator } from "$lib/shared/pictograph/prop/services/implementations/OrientationCalculator";
import type { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

/**
 * Details about an orientation continuity error
 */
export interface OrientationContinuityError {
  /** The step index where the error occurs */
  stepIndex: number;
  /** The color that has the orientation break */
  color: MotionColor;
  /** Expected start orientation (from previous beat's end) */
  expectedStartOrientation: string;
  /** Actual start orientation in the beat */
  actualStartOrientation: string;
  /** Description of the error */
  message: string;
}

/**
 * Result of a transition validation
 */
export interface TransitionValidationResult {
  /** Whether the transition is valid */
  valid: boolean;
  /** Errors found during validation (empty if valid) */
  errors: OrientationContinuityError[];
}

export interface IOrientationContinuityValidator {
  /**
   * Validate an entire sequence for orientation continuity.
   * Checks that each beat's start orientation matches the previous beat's end orientation.
   *
   * @param sequence - The sequence to validate
   * @returns Array of errors (empty if sequence is valid)
   */
  validateSequence(sequence: SequenceData): OrientationContinuityError[];

  /**
   * Validate that a pictograph can follow the last beat in the sequence.
   * Checks orientation continuity before adding the pictograph.
   *
   * @param lastStep - The last beat in the current sequence
   * @param nextPictograph - The pictograph to potentially add
   * @param orientationCalculator - Calculator to derive orientations
   * @returns Validation result with any errors found
   */
  validateTransition(
    lastStep: StepData,
    nextPictograph: PictographData,
    orientationCalculator: OrientationCalculator
  ): TransitionValidationResult;
}
