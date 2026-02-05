/**
 * Sequence Aligner Interface
 *
 * Aligns two sequences to find the best correspondence between beats.
 * Uses principles from dynamic programming alignment algorithms:
 * - Global alignment (Needleman-Wunsch style): Align entire sequences
 * - Local alignment (Smith-Waterman style): Find best matching sub-regions
 * - Circular alignment: Handle circular sequences with rotation
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { SpatialTransform } from "../../domain/models/signatures";

/**
 * Result of aligning two sequences.
 */
export interface AlignmentResult {
  /** Overall alignment score (0.0 - 1.0) */
  readonly score: number;

  /** Beat-by-beat alignment */
  readonly alignment: readonly AlignedBeatPair[];

  /** Number of beats that matched well (similarity > 0.7) */
  readonly matchedBeats: number;

  /** Number of beats that matched poorly (similarity < 0.3) */
  readonly mismatchedBeats: number;

  /** Number of gaps in the alignment (beats with no correspondence) */
  readonly gaps: number;
}

/**
 * A pair of aligned beats from two sequences.
 */
export interface AlignedBeatPair {
  /** Index in sequence A (null = gap in A) */
  readonly indexA: number | null;

  /** Index in sequence B (null = gap in B) */
  readonly indexB: number | null;

  /** Similarity score between these beats (0.0 - 1.0) */
  readonly similarity: number;

  /** Spatial transform that relates these beats (if any) */
  readonly transform: SpatialTransform | null;
}

/**
 * Result of local alignment - includes the region boundaries.
 */
export interface LocalAlignmentResult extends AlignmentResult {
  /** Region in sequence A that was matched */
  readonly regionA: { readonly start: number; readonly end: number };

  /** Region in sequence B that was matched */
  readonly regionB: { readonly start: number; readonly end: number };
}

/**
 * Result of circular alignment - includes the optimal rotation offset.
 */
export interface CircularAlignmentResult extends AlignmentResult {
  /** Best circular offset (how many beats to rotate sequence B) */
  readonly circularOffset: number;
}

/**
 * Options for alignment algorithms.
 */
export interface AlignmentOptions {
  /** Penalty for opening a gap (default: -0.5) */
  readonly gapOpenPenalty?: number;

  /** Penalty for extending a gap (default: -0.1) */
  readonly gapExtendPenalty?: number;

  /** Minimum similarity to consider a match (default: 0.3) */
  readonly matchThreshold?: number;

  /** Whether to try spatial transforms when aligning (default: true) */
  readonly trySpatialTransforms?: boolean;
}

/**
 * Service for aligning sequences using dynamic programming algorithms.
 */
export interface ISequenceAligner {
  /**
   * Global alignment - align entire sequences end-to-end.
   * Uses Needleman-Wunsch style algorithm.
   *
   * @param seqA First sequence
   * @param seqB Second sequence
   * @param options Alignment options
   * @returns Alignment result with score and beat correspondences
   */
  alignGlobal(
    seqA: SequenceData,
    seqB: SequenceData,
    options?: AlignmentOptions
  ): AlignmentResult;

  /**
   * Local alignment - find best matching regions within sequences.
   * Uses Smith-Waterman style algorithm.
   *
   * @param seqA First sequence
   * @param seqB Second sequence
   * @param options Alignment options
   * @returns Local alignment result with matched regions
   */
  alignLocal(
    seqA: SequenceData,
    seqB: SequenceData,
    options?: AlignmentOptions
  ): LocalAlignmentResult;

  /**
   * Circular alignment - align circular sequences considering rotation.
   * Tries all circular rotations of seqB to find the best alignment.
   *
   * @param seqA First sequence (assumed circular)
   * @param seqB Second sequence (assumed circular)
   * @param options Alignment options
   * @returns Circular alignment result with optimal rotation offset
   */
  alignCircular(
    seqA: SequenceData,
    seqB: SequenceData,
    options?: AlignmentOptions
  ): CircularAlignmentResult;
}
