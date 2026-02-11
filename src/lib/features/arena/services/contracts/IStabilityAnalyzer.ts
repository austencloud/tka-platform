/**
 * IStabilityAnalyzer
 *
 * Analyzes convergence of the rating pool.
 */

import type { ArenaRating } from "../../domain/models/arena-models";

export interface StabilityReport {
  /** Percentage of entries with phi < STABLE_PHI_THRESHOLD */
  convergencePercent: number;
  /** Number of entries still in cold-start (< COLD_START_THRESHOLD matchups) */
  coldStartCount: number;
  /** Total entries in the pool */
  totalEntries: number;
  /** Average rating deviation across all entries */
  averagePhi: number;
}

export interface IStabilityAnalyzer {
  /** Analyze convergence of the entire rating pool */
  analyzePool(ratings: ArenaRating[]): StabilityReport;

  /** Whether a single entry's rating is stable */
  isStable(rating: ArenaRating): boolean;

  /**
   * Confidence that entry A is truly ranked above entry B.
   * Returns a value in [0, 1] based on the overlap of their rating distributions.
   */
  pairwiseConfidence(a: ArenaRating, b: ArenaRating): number;
}
