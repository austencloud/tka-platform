/**
 * StabilityAnalyzer
 *
 * Assesses convergence of the arena rating pool.
 * Uses phi (rating deviation) as the primary signal of uncertainty.
 */

import type { StabilityReport } from "../contracts/types";
import type { ArenaRating } from "../../domain/models/arena-models";
import {
  STABLE_PHI_THRESHOLD,
  COLD_START_THRESHOLD,
} from "../../domain/constants/arena-constants";

export class StabilityAnalyzer {
  analyzePool(ratings: ArenaRating[]): StabilityReport {
    if (ratings.length === 0) {
      return {
        convergencePercent: 0,
        coldStartCount: 0,
        totalEntries: 0,
        averagePhi: 0,
      };
    }

    let stableCount = 0;
    let coldStartCount = 0;
    let totalPhi = 0;

    for (const r of ratings) {
      totalPhi += r.phi;
      if (this.isStable(r)) stableCount++;
      if (r.totalMatchups < COLD_START_THRESHOLD) coldStartCount++;
    }

    return {
      convergencePercent: (stableCount / ratings.length) * 100,
      coldStartCount,
      totalEntries: ratings.length,
      averagePhi: totalPhi / ratings.length,
    };
  }

  isStable(rating: ArenaRating): boolean {
    return rating.phi < STABLE_PHI_THRESHOLD;
  }

  pairwiseConfidence(a: ArenaRating, b: ArenaRating): number {
    // Probability that A's true rating exceeds B's true rating,
    // modeled as the difference of two normal distributions.
    const muDiff = a.mu - b.mu;
    const combinedPhi = Math.sqrt(a.phi * a.phi + b.phi * b.phi);

    if (combinedPhi === 0) return muDiff > 0 ? 1 : muDiff < 0 ? 0 : 0.5;

    // Approximate normal CDF using the logistic approximation
    const z = muDiff / combinedPhi;
    return 1 / (1 + Math.exp(-1.7 * z));
  }
}
