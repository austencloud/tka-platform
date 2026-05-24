import type { Deck } from "../domain/models/Deck";
import type { DeckReleaseCard, StepCountWeight } from "../domain/models/DeckRelease";

interface PoolEntry {
  sequenceId: string;
  sourceDeckId: string;
  stepCount: number;
  word: string;
}

export function buildSequencePool(decks: Deck[]): Map<number, PoolEntry[]> {
  const pool = new Map<number, PoolEntry[]>();

  for (const deck of decks) {
    if (deck.collection !== "LOOPs") continue;
    const stepCount = deck.stepCount;
    if (!pool.has(stepCount)) pool.set(stepCount, []);
    const bucket = pool.get(stepCount)!;

    for (const family of deck.families) {
      for (const seqId of family.sequenceIds) {
        bucket.push({
          sequenceId: seqId,
          sourceDeckId: deck.id,
          stepCount,
          word: seqId,
        });
      }
    }
  }

  return pool;
}

export function getAvailableWeights(pool: Map<number, PoolEntry[]>): StepCountWeight[] {
  const weights: StepCountWeight[] = [];
  const defaultWeights: Record<number, number> = { 16: 40, 8: 25, 12: 20, 4: 15 };

  for (const [stepCount, entries] of pool) {
    if (entries.length === 0) continue;
    weights.push({
      stepCount,
      weight: defaultWeights[stepCount] ?? 10,
      available: entries.length,
    });
  }

  weights.sort((a, b) => b.stepCount - a.stepCount);
  return weights;
}

export function composeDeck(
  pool: Map<number, PoolEntry[]>,
  weights: StepCountWeight[],
  totalCards: number,
): DeckReleaseCard[] {
  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
  if (totalWeight === 0) return [];

  const targets = new Map<number, number>();
  let allocated = 0;

  for (let i = 0; i < weights.length; i++) {
    const w = weights[i]!;
    const isLast = i === weights.length - 1;
    const target = isLast
      ? totalCards - allocated
      : Math.round((totalCards * w.weight) / totalWeight);
    const clamped = Math.min(target, pool.get(w.stepCount)?.length ?? 0);
    targets.set(w.stepCount, clamped);
    allocated += clamped;
  }

  const selected: PoolEntry[] = [];

  for (const [stepCount, count] of targets) {
    const bucket = pool.get(stepCount);
    if (!bucket || count === 0) continue;
    const shuffled = fisherYatesSample(bucket, count);
    selected.push(...shuffled);
  }

  shuffle(selected);

  return selected.map((entry, i) => ({
    sequenceId: entry.sequenceId,
    sourceDeckId: entry.sourceDeckId,
    stepCount: entry.stepCount,
    word: entry.word,
    position: i + 1,
  }));
}

export function swapCard(
  cards: DeckReleaseCard[],
  index: number,
  pool: Map<number, PoolEntry[]>,
): DeckReleaseCard[] {
  const card = cards[index];
  if (!card) return cards;

  const bucket = pool.get(card.stepCount);
  if (!bucket) return cards;

  const usedIds = new Set(cards.map((c) => c.sequenceId));
  const available = bucket.filter((e) => !usedIds.has(e.sequenceId));
  if (available.length === 0) return cards;

  const replacement = available[Math.floor(Math.random() * available.length)]!;
  const updated = [...cards];
  updated[index] = {
    sequenceId: replacement.sequenceId,
    sourceDeckId: replacement.sourceDeckId,
    stepCount: replacement.stepCount,
    word: replacement.word,
    position: card.position,
  };
  return updated;
}

function fisherYatesSample<T>(arr: T[], count: number): T[] {
  const copy = [...arr];
  const n = Math.min(count, copy.length);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy.slice(0, n);
}

function shuffle<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
}
