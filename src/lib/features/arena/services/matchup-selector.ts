/**
 * MatchupSelector
 *
 * Three-tier matchmaking algorithm:
 * 1. Cold-start: pair unrated entries against a well-established median pivot
 * 2. Info-gain: sample candidates, pick the pair maximizing (phi_A + phi_B) * competitiveness * staleness
 * 3. Random: 10% fully random pairs for exploration
 */

import type { MatchupCandidate } from "./types";
import type { MatchupReason } from "../domain/models/arena-models";
import {
  COLD_START_THRESHOLD,
  MATCHMAKING_SAMPLE_SIZE,
  RANDOM_MATCHUP_RATE,
  INITIAL_MU,
} from "../domain/constants/arena-constants";

export function selectMatchup(
  candidates: MatchupCandidate[],
  voterId: string,
  recentPairs: Set<string>
): { a: MatchupCandidate; b: MatchupCandidate; reason: MatchupReason } | null {
  if (candidates.length < 2) return null;
  const pool = candidates;

  // Group by beat count - only pit same-length sequences against each other
  const groups = groupByBeatCount(pool);

  // Try each group from largest to smallest (more variety = better matchmaking)
  for (const group of groups) {
    if (group.length < 2) continue;
    const result = selectFromPool(group, recentPairs);
    if (result) return result;
  }

  return null;
}

/**
 * Run the three-tier matchmaking within a same-length pool.
 */
function selectFromPool(
  pool: MatchupCandidate[],
  recentPairs: Set<string>
): { a: MatchupCandidate; b: MatchupCandidate; reason: MatchupReason } | null {
  // 10% chance of fully random matchup
  if (Math.random() < RANDOM_MATCHUP_RATE) {
    const pair = pickRandomPair(pool, recentPairs);
    if (pair) return { ...pair, reason: "random" };
  }

  // Cold-start: find entries with < COLD_START_THRESHOLD matchups
  const coldEntries = pool.filter(
    (c) => c.rating.totalMatchups < COLD_START_THRESHOLD
  );

  if (coldEntries.length > 0) {
    const pair = coldStartPair(coldEntries, pool, recentPairs);
    if (pair) return { ...pair, reason: "cold_start" };
  }

  // Info-gain: sample and pick the best pair
  const pair = infoGainPair(pool, recentPairs);
  if (pair) return { ...pair, reason: "info_gain" };

  // Fallback to random
  const fallback = pickRandomPair(pool, recentPairs);
  if (fallback) return { ...fallback, reason: "random" };

  return null;
}

/**
 * Group candidates by beat count, sorted largest group first.
 */
function groupByBeatCount(pool: MatchupCandidate[]): MatchupCandidate[][] {
  const map = new Map<number, MatchupCandidate[]>();
  for (const c of pool) {
    // Use sequenceLength from index metadata - steps are empty at pool-load time
    const stepCount = c.data.sequenceLength ?? c.data.steps?.length ?? 0;
    if (stepCount === 0) continue;
    const group = map.get(stepCount);
    if (group) {
      group.push(c);
    } else {
      map.set(stepCount, [c]);
    }
  }
  return [...map.values()].sort((a, b) => b.length - a.length);
}

/**
 * Pair a cold-start entry against a well-established pivot near the median.
 */
function coldStartPair(
  coldEntries: MatchupCandidate[],
  pool: MatchupCandidate[],
  recentPairs: Set<string>
): { a: MatchupCandidate; b: MatchupCandidate } | null {
  // Find established entries (past cold start threshold)
  const established = pool.filter(
    (c) => c.rating.totalMatchups >= COLD_START_THRESHOLD
  );

  // Pick pivot: established entry closest to median rating
  const pivotPool = established.length >= 3 ? established : pool;
  const sorted = [...pivotPool].sort((a, b) => a.rating.mu - b.rating.mu);
  const medianIdx = Math.floor(sorted.length / 2);
  const pivot = sorted[medianIdx];

  // Pick a random cold entry
  const cold = coldEntries[Math.floor(Math.random() * coldEntries.length)];
  if (!cold || !pivot) return null;

  if (cold.entry.id === pivot.entry.id) return null;
  if (isPairRecent(cold.entry.id, pivot.entry.id, recentPairs)) return null;

  return { a: cold, b: pivot };
}

/**
 * Information-gain maximization: sample pairs and pick the one with the
 * highest (phi_A + phi_B) * competitiveness * staleness score.
 */
function infoGainPair(
  pool: MatchupCandidate[],
  recentPairs: Set<string>
): { a: MatchupCandidate; b: MatchupCandidate } | null {
  const sampleSize = Math.min(MATCHMAKING_SAMPLE_SIZE, pool.length);
  const sampled = sampleWithoutReplacement(pool, sampleSize);

  let bestScore = -1;
  let bestA: MatchupCandidate | null = null;
  let bestB: MatchupCandidate | null = null;

  // Evaluate all pairs in the sample
  for (let i = 0; i < sampled.length; i++) {
    for (let j = i + 1; j < sampled.length; j++) {
      const a = sampled[i]!;
      const b = sampled[j]!;

      if (isPairRecent(a.entry.id, b.entry.id, recentPairs)) continue;

      const uncertainty = a.rating.phi + b.rating.phi;
      const ratingDiff = Math.abs(a.rating.mu - b.rating.mu);
      const competitiveness = Math.exp(-ratingDiff / INITIAL_MU);
      const stalenessA = staleness(a.rating.lastMatchAt);
      const stalenessB = staleness(b.rating.lastMatchAt);
      const stalenessScore = (stalenessA + stalenessB) / 2;

      const score = uncertainty * competitiveness * stalenessScore;

      if (score > bestScore) {
        bestScore = score;
        bestA = a;
        bestB = b;
      }
    }
  }

  if (!bestA || !bestB) return null;
  return { a: bestA, b: bestB };
}

function pickRandomPair(
  pool: MatchupCandidate[],
  recentPairs: Set<string>
): { a: MatchupCandidate; b: MatchupCandidate } | null {
  // Try up to 20 times to find a non-recent pair
  for (let attempt = 0; attempt < 20; attempt++) {
    const idxA = Math.floor(Math.random() * pool.length);
    let idxB = Math.floor(Math.random() * (pool.length - 1));
    if (idxB >= idxA) idxB++;

    const a = pool[idxA]!;
    const b = pool[idxB]!;

    if (!isPairRecent(a.entry.id, b.entry.id, recentPairs)) {
      return { a, b };
    }
  }
  return null;
}

function isPairRecent(idA: string, idB: string, recentPairs: Set<string>): boolean {
  const key = idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`;
  return recentPairs.has(key);
}

/** Staleness multiplier: entries not matched recently get higher priority */
function staleness(lastMatchAt: Date): number {
  const hoursSince = (Date.now() - lastMatchAt.getTime()) / (1000 * 60 * 60);
  // Logarithmic: diminishing returns past ~24 hours
  return 1 + Math.log2(1 + hoursSince / 24);
}

/** Fisher-Yates partial shuffle to sample k items without replacement */
function sampleWithoutReplacement<T>(arr: T[], k: number): T[] {
  const copy = [...arr];
  const n = copy.length;
  const result: T[] = [];
  for (let i = 0; i < k && i < n; i++) {
    const j = i + Math.floor(Math.random() * (n - i));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
    result.push(copy[i]!);
  }
  return result;
}
