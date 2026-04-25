/**
 * Sequence Equivalence Detector Contract
 *
 * Detects when two sequences are equivalent despite transforms:
 * 1. Spatial rotation (45° increments around the grid, including diamond↔box mode)
 * 2. Circular rotation (different starting beat in circular sequences)
 *
 * Two sequences are "equivalent" if one can be transformed into the other
 * through these operations while preserving the fundamental motion pattern.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

/**
 * Result of equivalence comparison
 */
export interface EquivalenceResult {
  /** Whether the sequences are equivalent under any supported transform */
  readonly isEquivalent: boolean;

  /** Type of equivalence found (if any) */
  readonly equivalenceType: EquivalenceType | null;

  /** Details about the transform that makes them equivalent */
  readonly transform: TransformDetails | null;
}

/**
 * Types of equivalence supported
 */
export type EquivalenceType =
  | "identical" // Exact same sequence
  | "spatial-rotation" // Same sequence rotated around grid
  | "circular-rotation" // Same circular sequence starting at different beat
  | "combined"; // Both spatial and circular rotation

/**
 * Details about the transform that makes sequences equivalent
 */
export interface TransformDetails {
  /** Number of 45° steps rotated (0-7), null if no spatial rotation */
  readonly spatialRotationSteps: number | null;

  /** Number of beats shifted in circular sequence, null if no circular rotation */
  readonly circularOffset: number | null;

  /** Whether grid mode changed (odd spatial rotation steps) */
  readonly gridModeToggled: boolean;
}

/**
 * Canonical signature for a sequence
 * Used for efficient comparison and hashing
 */
export interface SequenceSignature {
  /** Word (letter sequence) */
  readonly word: string;

  /** Number of steps */
  readonly stepCount: number;

  /** Whether sequence is circular */
  readonly isCircular: boolean;

  /** Normalized beat signatures (rotation-invariant) */
  readonly beatSignatures: readonly StepSignature[];

  /** Hash for quick inequality check */
  readonly hash: string;
}

/**
 * Rotation-invariant signature for a single beat
 */
export interface StepSignature {
  /** Blue motion signature */
  readonly blue: MotionSignature;

  /** Red motion signature */
  readonly red: MotionSignature;

  /** Position group (alpha, beta, gamma, etc.) - not the numbered variant */
  readonly positionGroup: string;
}

/**
 * Rotation-invariant signature for a single motion
 */
export interface MotionSignature {
  /** Motion type: pro, anti, static, dash */
  readonly type: string;

  /** Rotation direction: cw, ccw, noRotation */
  readonly direction: string;

  /** Number of turns */
  readonly turns: number | string;

  /** Orientation transition: in→in, in→out, out→in, out→out */
  readonly orientationTransition: string;
}

export interface ISequenceEquivalenceDetector {
  /**
   * Check if two sequences are equivalent under any supported transform
   */
  areEquivalent(sequenceA: SequenceData, sequenceB: SequenceData): EquivalenceResult;

  /**
   * Generate a canonical signature for a sequence
   * Useful for indexing and quick comparison
   */
  generateSignature(sequence: SequenceData): SequenceSignature;

  /**
   * Generate a rotation-normalized version of a sequence
   * Normalizes to a canonical spatial orientation
   */
  normalizeRotation(sequence: SequenceData): SequenceData;

  /**
   * Find all sequences in a collection that are equivalent to the target
   */
  findEquivalentSequences(
    target: SequenceData,
    candidates: readonly SequenceData[]
  ): readonly { sequence: SequenceData; equivalence: EquivalenceResult }[];
}
