/**
 * Motion Signature Generator Contract
 *
 * Creates rotation-invariant signatures for individual motions.
 * These signatures capture the geometric essence of a motion
 * independent of its absolute position on the grid.
 */

import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type { MotionSignature, MotionComparisonResult } from "../../domain/models/signatures";

export interface IMotionSignatureGenerator {
  /**
   * Generate a rotation-invariant signature for a single motion.
   *
   * The signature captures:
   * - Motion type (pro, anti, static, dash, float)
   * - Rotation direction
   * - Turn count
   * - Orientation transition
   * - Hand movement (as angular delta, not absolute positions)
   *
   * @param motion - The motion data to generate signature for
   * @returns A rotation-invariant signature
   */
  generateSignature(motion: MotionData): MotionSignature;

  /**
   * Check if two motion signatures are exactly equal.
   *
   * @param a - First signature
   * @param b - Second signature
   * @returns true if signatures represent geometrically identical motions
   */
  signaturesMatch(a: MotionSignature, b: MotionSignature): boolean;

  /**
   * Compute similarity score between two motion signatures.
   *
   * @param a - First signature
   * @param b - Second signature
   * @returns Detailed comparison result with score and breakdown
   */
  compareSignatures(a: MotionSignature, b: MotionSignature): MotionComparisonResult;

  /**
   * Generate a compact string hash of a signature for quick comparison.
   *
   * @param signature - The signature to hash
   * @returns A string that uniquely identifies this signature
   */
  hashSignature(signature: MotionSignature): string;
}
