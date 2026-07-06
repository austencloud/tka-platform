/**
 * Deterministic representative picks for the gallery drill's content peeks.
 *
 * The chooser tiles preview REAL sequences from each bucket (Spotify
 * genre-card style). Picks must be deterministic — random rotation reads as
 * instability and causes layout/identity churn between visits — so every
 * picker sorts by the grid's default kinetic-alphabet order and takes the
 * front of the list.
 */
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import {
  resolveDifficultyLevel,
  resolveStepCount,
} from "$lib/shared/browse/services/browse-sorter";
import {
  compareKineticLetters,
  extractBaseLetter,
  sortSequencesByKineticAlphabet,
} from "$lib/shared/browse/utils/kinetic-alphabet-sort";

function firstByAlphabet(pool: SequenceData[]): SequenceData | undefined {
  return sortSequencesByKineticAlphabet([...pool])[0];
}

/** One representative sequence per difficulty level present in the pool. */
export function pickLevelRepresentatives(
  pool: readonly SequenceData[],
  levels: readonly number[],
): Map<number, SequenceData> {
  const reps = new Map<number, SequenceData>();
  for (const level of levels) {
    const rep = firstByAlphabet(
      pool.filter((seq) => resolveDifficultyLevel(seq) === level),
    );
    if (rep) reps.set(level, rep);
  }
  return reps;
}

/**
 * A shortest-bucket and longest-bucket representative. `minCount` mirrors the
 * value screen's bucket floor so the peeks preview buckets that actually
 * appear as choices.
 */
export function pickLengthPair(
  pool: readonly SequenceData[],
  minCount = 3,
): { short?: SequenceData; long?: SequenceData; min?: number; max?: number } {
  const buckets = new Map<number, SequenceData[]>();
  for (const seq of pool) {
    const n = resolveStepCount(seq);
    if (n <= 0) continue;
    const bucket = buckets.get(n);
    if (bucket) bucket.push(seq);
    else buckets.set(n, [seq]);
  }
  const eligible = [...buckets.entries()]
    .filter(([, seqs]) => seqs.length >= minCount)
    .map(([n]) => n)
    .sort((a, b) => a - b);
  if (eligible.length === 0) return {};
  const min = eligible[0]!;
  const max = eligible[eligible.length - 1]!;
  return {
    short: firstByAlphabet(buckets.get(min) ?? []),
    long: firstByAlphabet(buckets.get(max) ?? []),
    min,
    max,
  };
}

/** First `n` sequences in the grid's default order — an honest preview of the
 * exact grid "Show all" lands on. */
export function pickCollage(
  pool: readonly SequenceData[],
  n = 4,
): SequenceData[] {
  return sortSequencesByKineticAlphabet([...pool]).slice(0, n);
}

/** Distinct creators present in the pool — the legacy author_section, ported
 * to the web data model: `ownerDisplayName` is the human on the card;
 * `author` is legacy metadata (often a tool attribution like "TKA Explore"). */
export function deriveCreators(pool: readonly SequenceData[]): string[] {
  const creators = new Set<string>();
  for (const seq of pool) {
    const name = seq.ownerDisplayName?.trim();
    if (name) creators.add(name);
  }
  return [...creators];
}

/** Up to `n` of each creator's own sequences (kinetic-alphabet order, so the
 * same work fronts a creator's row every visit). Keyed by ownerDisplayName —
 * the creator screen's row art, so a name is backed by the actual work. */
export function pickCreatorSamples(
  pool: readonly SequenceData[],
  n = 3,
): Map<string, SequenceData[]> {
  const byCreator = new Map<string, SequenceData[]>();
  for (const seq of sortSequencesByKineticAlphabet([...pool])) {
    const name = seq.ownerDisplayName?.trim();
    if (!name) continue;
    const bucket = byCreator.get(name);
    if (!bucket) byCreator.set(name, [seq]);
    else if (bucket.length < n) bucket.push(seq);
  }
  return byCreator;
}

/** Distinct base letters present in the pool (incl. dash variants like "W-"),
 * in canonical kinetic-alphabet order. These are the letter screen's values —
 * derived from real words, so no letter is ever a dead end. */
export function deriveStartingLetters(
  pool: readonly SequenceData[],
): string[] {
  const letters = new Set<string>();
  for (const seq of pool) {
    const letter = extractBaseLetter(seq.word ?? "");
    if (letter) letters.add(letter);
  }
  return [...letters].sort(compareKineticLetters);
}
