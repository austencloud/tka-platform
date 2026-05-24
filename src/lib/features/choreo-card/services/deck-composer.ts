import type { Deck } from "../domain/models/Deck";
import type { DeckReleaseCard, StepCountWeight } from "../domain/models/DeckRelease";
import { tokenizeWord } from "$lib/shared/pictograph/tka-glyph/utils/word-tokenizer";
import { getLetterType } from "$lib/shared/foundation/domain/models/Letter";
import { Letter } from "$lib/shared/foundation/domain/models/Letter";
import { LetterType } from "$lib/shared/foundation/domain/models/LetterType";

interface PoolEntry {
  sequenceId: string;
  sourceDeckId: string;
  stepCount: number;
  word: string;
}

export interface DeckPoolFilter {
  sliceTypes: Set<'halved' | 'quartered'>;
}

function isZeroTurnDeck(deck: Deck): boolean {
  if (!deck.turnPattern) return false;
  const m = deck.turnPattern.match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) === 0 : false;
}

function containsType6(word: string): boolean {
  const tokens = tokenizeWord(word);
  return tokens.some((token) => {
    try {
      return getLetterType(token as Letter) === LetterType.TYPE6;
    } catch {
      return false;
    }
  });
}

export function buildSequencePool(decks: Deck[], filter?: DeckPoolFilter): Map<number, PoolEntry[]> {
  const pool = new Map<number, PoolEntry[]>();

  for (const deck of decks) {
    if (deck.collection !== "LOOPs") continue;
    if (filter?.sliceTypes && !filter.sliceTypes.has(deck.sliceType)) continue;
    const stepCount = deck.stepCount;
    const zeroTurn = isZeroTurnDeck(deck);
    if (!pool.has(stepCount)) pool.set(stepCount, []);
    const bucket = pool.get(stepCount)!;

    for (const family of deck.families) {
      for (const seqId of family.sequenceIds) {
        if (zeroTurn && containsType6(seqId)) continue;
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

export interface DeckSourceSummary {
  sliceType: 'halved' | 'quartered';
  deckCount: number;
  sequenceCount: number;
}

export function getDeckSourceSummaries(decks: Deck[]): DeckSourceSummary[] {
  const map = new Map<string, { deckCount: number; sequenceCount: number }>();
  for (const deck of decks) {
    if (deck.collection !== "LOOPs") continue;
    const entry = map.get(deck.sliceType) ?? { deckCount: 0, sequenceCount: 0 };
    entry.deckCount++;
    entry.sequenceCount += deck.totalSequences;
    map.set(deck.sliceType, entry);
  }
  return Array.from(map.entries()).map(([sliceType, stats]) => ({
    sliceType: sliceType as 'halved' | 'quartered',
    ...stats,
  }));
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
  let remaining = totalCards;
  const saturated = new Set<number>();

  for (const w of weights) {
    const ideal = Math.round((totalCards * w.weight) / totalWeight);
    const available = pool.get(w.stepCount)?.length ?? 0;
    const clamped = Math.min(ideal, available);
    targets.set(w.stepCount, clamped);
    remaining -= clamped;
    if (clamped === available) saturated.add(w.stepCount);
  }

  while (remaining > 0) {
    const unsaturated = weights.filter(
      (w) => !saturated.has(w.stepCount) && (targets.get(w.stepCount) ?? 0) < (pool.get(w.stepCount)?.length ?? 0)
    );
    if (unsaturated.length === 0) break;

    const subWeight = unsaturated.reduce((s, w) => s + w.weight, 0);
    let distributed = 0;
    for (const w of unsaturated) {
      const current = targets.get(w.stepCount) ?? 0;
      const available = pool.get(w.stepCount)?.length ?? 0;
      const extra = Math.min(
        Math.round((remaining * w.weight) / subWeight),
        available - current,
      );
      targets.set(w.stepCount, current + extra);
      distributed += extra;
      if (current + extra === available) saturated.add(w.stepCount);
    }
    remaining -= distributed;
    if (distributed === 0) break;
  }

  const selected: PoolEntry[] = [];

  for (const [stepCount, count] of targets) {
    const bucket = pool.get(stepCount);
    if (!bucket || count === 0) continue;
    selected.push(...fisherYatesSample(bucket, count));
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

// ---------------------------------------------------------------------------
// VTG deck helpers
// ---------------------------------------------------------------------------

export interface VtgFamilyOption {
  familyId: string;
  label: string;
  sequenceCount: number;
  sequenceIds: readonly string[];
  sourceDeckId: string;
}

export function getVtgFamilyOptions(decks: Deck[]): VtgFamilyOption[] {
  const options: VtgFamilyOption[] = [];
  for (const deck of decks) {
    if (deck.collection !== "VTG") continue;
    for (const family of deck.families) {
      options.push({
        familyId: family.id,
        label: family.label,
        sequenceCount: family.sequenceIds.length,
        sequenceIds: family.sequenceIds,
        sourceDeckId: deck.id,
      });
    }
  }
  return options;
}

export function buildVtgCards(
  vtgFamilies: VtgFamilyOption[],
  selectedFamilies: Set<string>,
): DeckReleaseCard[] {
  const cards: DeckReleaseCard[] = [];
  for (const fam of vtgFamilies) {
    if (!selectedFamilies.has(fam.familyId)) continue;
    for (const seqId of fam.sequenceIds) {
      cards.push({
        sequenceId: seqId,
        sourceDeckId: fam.sourceDeckId,
        stepCount: 4,
        word: seqId,
        position: 0,
      });
    }
  }
  return cards;
}

export function prunePool(
  pool: Map<number, PoolEntry[]>,
  excludeIds: Set<string>,
  exemptStepCounts?: Set<number>,
): void {
  for (const [stepCount, entries] of pool) {
    if (exemptStepCounts?.has(stepCount)) continue;
    pool.set(stepCount, entries.filter(e => !excludeIds.has(e.sequenceId)));
  }
}
