/**
 * Beat Signature Generator Contract
 *
 * Creates rotation-invariant signatures for complete beats (both hands).
 * Composes motion signatures with position group information.
 */

import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import type { StepSignature, StepComparisonResult } from "../../domain/models/signatures";

export interface IStepSignatureGenerator {
  /**
   * Generate a rotation-invariant signature for a complete beat.
   *
   * The signature captures:
   * - Position groups (not specific variants)
   * - Motion signatures for both hands
   * - Angular relationship between hands
   *
   * @param step - The step data to generate signature for
   * @returns A rotation-invariant beat signature
   */
  generateSignature(step: StepData): StepSignature;

  /**
   * Check if two beat signatures are exactly equivalent.
   *
   * @param a - First beat signature
   * @param b - Second beat signature
   * @returns true if beats are geometrically identical
   */
  signaturesMatch(a: StepSignature, b: StepSignature): boolean;

  /**
   * Compute detailed similarity between two beat signatures.
   *
   * @param a - First beat signature
   * @param b - Second beat signature
   * @returns Detailed comparison result with score and breakdown
   */
  compareSignatures(a: StepSignature, b: StepSignature): StepComparisonResult;

  /**
   * Generate signatures for all beats in a sequence of steps.
   *
   * @param steps - Array of step data
   * @returns Array of beat signatures in same order
   */
  generateSignatures(steps: readonly StepData[]): readonly StepSignature[];
}
