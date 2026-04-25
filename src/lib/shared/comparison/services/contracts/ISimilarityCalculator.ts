/**
 * Similarity Calculator Interface
 *
 * Computes detailed similarity metrics between sequences.
 * Provides comprehensive reports with breakdowns by different aspects.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

/**
 * Comprehensive similarity report between two sequences.
 */
export interface SimilarityReport {
  /** Overall similarity score (0.0 - 1.0) */
  readonly overallScore: number;

  /** Component similarity scores */
  readonly wordSimilarity: number;
  readonly motionSimilarity: number;
  readonly positionSimilarity: number;
  readonly structuralSimilarity: number;

  /** Per-beat similarity scores */
  readonly stepByBeatScores: readonly number[];

  /** Common subsequences found between the sequences */
  readonly commonSubsequences: readonly CommonSubsequence[];

  /** Human-readable summary of the comparison */
  readonly summary: string;

  /** Detailed breakdown of what matches and what differs */
  readonly breakdown: SimilarityBreakdown;
}

/**
 * A common subsequence found in both sequences.
 */
export interface CommonSubsequence {
  /** Starting index in sequence A */
  readonly startIndexA: number;

  /** Starting index in sequence B */
  readonly startIndexB: number;

  /** Length of the common subsequence */
  readonly length: number;

  /** Average similarity of beats in this subsequence */
  readonly similarity: number;
}

/**
 * Detailed breakdown of similarity components.
 */
export interface SimilarityBreakdown {
  /** Length comparison */
  readonly lengthMatch: boolean;
  readonly lengthDifference: number;

  /** Circularity comparison */
  readonly circularityMatch: boolean;

  /** Word comparison */
  readonly wordMatch: boolean;
  readonly wordEditDistance: number;

  /** Motion pattern analysis */
  readonly motionTypeMatches: number;
  readonly motionTypeMismatches: number;

  /** Position pattern analysis */
  readonly positionGroupMatches: number;
  readonly positionGroupMismatches: number;

  /** Individual beat analysis */
  readonly perfectBeatMatches: number;
  readonly partialBeatMatches: number;
  readonly beatMismatches: number;
}

/**
 * Quick similarity result (less detailed, faster computation).
 */
export interface QuickSimilarityResult {
  /** Overall similarity score (0.0 - 1.0) */
  readonly score: number;

  /** Whether sequences are likely equivalent */
  readonly likelyEquivalent: boolean;

  /** Confidence in the assessment (0.0 - 1.0) */
  readonly confidence: number;
}

/**
 * Options for similarity calculation.
 */
export interface SimilarityOptions {
  /** Weight for word similarity component (default: 0.2) */
  readonly wordWeight?: number;

  /** Weight for motion similarity component (default: 0.35) */
  readonly motionWeight?: number;

  /** Weight for position similarity component (default: 0.25) */
  readonly positionWeight?: number;

  /** Weight for structural similarity component (default: 0.2) */
  readonly structuralWeight?: number;

  /** Minimum subsequence length to report (default: 2) */
  readonly minSubsequenceLength?: number;

  /** Whether to consider spatial transforms (default: true) */
  readonly considerSpatialTransforms?: boolean;
}

/**
 * Service for computing detailed similarity metrics between sequences.
 */
export interface ISimilarityCalculator {
  /**
   * Compute comprehensive similarity report between two sequences.
   *
   * @param seqA First sequence
   * @param seqB Second sequence
   * @param options Calculation options
   * @returns Detailed similarity report
   */
  computeSimilarity(
    seqA: SequenceData,
    seqB: SequenceData,
    options?: SimilarityOptions
  ): SimilarityReport;

  /**
   * Quick similarity check (less detailed, faster).
   * Useful for filtering before full comparison.
   *
   * @param seqA First sequence
   * @param seqB Second sequence
   * @returns Quick similarity result
   */
  computeQuickScore(seqA: SequenceData, seqB: SequenceData): QuickSimilarityResult;

  /**
   * Find all common subsequences between two sequences.
   *
   * @param seqA First sequence
   * @param seqB Second sequence
   * @param minLength Minimum length of subsequences to find
   * @returns Array of common subsequences
   */
  findCommonSubsequences(
    seqA: SequenceData,
    seqB: SequenceData,
    minLength?: number
  ): readonly CommonSubsequence[];

  /**
   * Generate a human-readable summary of the similarity.
   *
   * @param report Similarity report to summarize
   * @returns Human-readable description
   */
  generateSummary(report: SimilarityReport): string;
}
