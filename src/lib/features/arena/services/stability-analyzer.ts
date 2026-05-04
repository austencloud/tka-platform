import type { StabilityReport } from "./contracts/types";
import type { ArenaRating } from "../domain/models/arena-models";
import {
  STABLE_PHI_THRESHOLD,
  COLD_START_THRESHOLD,
} from "../domain/constants/arena-constants";

export function analyzePool(ratings: ArenaRating[]): StabilityReport {
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
    if (isStable(r)) stableCount++;
    if (r.totalMatchups < COLD_START_THRESHOLD) coldStartCount++;
  }

  return {
    convergencePercent: (stableCount / ratings.length) * 100,
    coldStartCount,
    totalEntries: ratings.length,
    averagePhi: totalPhi / ratings.length,
  };
}

export function isStable(rating: ArenaRating): boolean {
  return rating.phi < STABLE_PHI_THRESHOLD;
}

export function pairwiseConfidence(a: ArenaRating, b: ArenaRating): number {
  const muDiff = a.mu - b.mu;
  const combinedPhi = Math.sqrt(a.phi * a.phi + b.phi * b.phi);

  if (combinedPhi === 0) return muDiff > 0 ? 1 : muDiff < 0 ? 0 : 0.5;

  const z = muDiff / combinedPhi;
  return 1 / (1 + Math.exp(-1.7 * z));
}
