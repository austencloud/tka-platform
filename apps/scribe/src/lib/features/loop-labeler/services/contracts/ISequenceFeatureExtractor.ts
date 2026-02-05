/**
 * Sequence Feature Extractor Service Contract
 *
 * Extracts analyzable features from sequences for rule-based tagging.
 * Used by auto-labeling systems to classify and categorize sequences.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type {
  SequenceFeatures,
  PositionDominance,
  ReversalAnalysis,
} from "../../domain/models/sequence-features";

export interface ISequenceFeatureExtractor {
  /**
   * Extract all analyzable features from a sequence
   *
   * This is the main entry point for feature extraction. It combines
   * circularity analysis, reversal detection, position dominance,
   * and motion complexity into a complete SequenceFeatures object.
   *
   * @param sequence - The sequence to analyze
   * @returns Complete feature analysis
   *
   * @example
   * const features = extractor.extractFeatures(sequence);
   * if (features.reversals.hasReversals && features.positionDominance.isBetaHeavy) {
   *   // Tag as "beta reversal sequence"
   * }
   */
  extractFeatures(sequence: SequenceData): SequenceFeatures;

  /**
   * Analyze reversals in a sequence
   *
   * Detects where blue and red hands change direction.
   *
   * @param sequence - The sequence to analyze
   * @returns Reversal analysis with counts and beat positions
   */
  analyzeReversals(sequence: SequenceData): ReversalAnalysis;

  /**
   * Calculate position group dominance
   *
   * Determines which position groups (alpha, beta, gamma) are most used.
   *
   * @param sequence - The sequence to analyze
   * @returns Position dominance analysis with percentages and flags
   */
  calculatePositionDominance(sequence: SequenceData): PositionDominance;
}
