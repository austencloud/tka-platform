import type { Catalog } from "../domain/models/Catalog";
import type { CardFooter, DeckReleaseCard, StepCountWeight } from "../domain/models/DeckRelease";
import { TND_BY_FAMILY } from "../domain/tnd-element";
import { tokenizeWord } from "$lib/shared/pictograph/tka-glyph/utils/word-tokenizer";
import { getLetterType } from "$lib/shared/foundation/domain/models/Letter";
import { Letter } from "$lib/shared/foundation/domain/models/Letter";
import { LetterType } from "$lib/shared/foundation/domain/models/LetterType";

interface PoolEntry {
  sequenceId: string;
  sourceCatalogId: string;
  stepCount: number;
  word: string;
}

export interface CatalogPoolFilter {
  sliceTypes: Set<'halved' | 'quartered'>;
}

function isZeroTurnCatalog(catalog: Catalog): boolean {
  if (!catalog.turnPattern) return false;
  const m = catalog.turnPattern.match(/(\d+(?:\.\d+)?)/);
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

export function buildSequencePool(catalogs: Catalog[], filter?: CatalogPoolFilter): Map<number, PoolEntry[]> {
  const pool = new Map<number, PoolEntry[]>();

  for (const catalog of catalogs) {
    if (catalog.collection !== "LOOPs") continue;
    if (filter?.sliceTypes && !filter.sliceTypes.has(catalog.sliceType)) continue;
    const stepCount = catalog.stepCount;
    const zeroTurn = isZeroTurnCatalog(catalog);
    if (!pool.has(stepCount)) pool.set(stepCount, []);
    const bucket = pool.get(stepCount)!;

    for (const family of catalog.families) {
      for (const seqId of family.sequenceIds) {
        if (zeroTurn && containsType6(seqId)) continue;
        bucket.push({
          sequenceId: seqId,
          sourceCatalogId: catalog.id,
          stepCount,
          word: seqId,
        });
      }
    }
  }

  return pool;
}

export interface CatalogSourceSummary {
  sliceType: 'halved' | 'quartered';
  catalogCount: number;
  sequenceCount: number;
}

export function getCatalogSourceSummaries(catalogs: Catalog[]): CatalogSourceSummary[] {
  const map = new Map<string, { catalogCount: number; sequenceCount: number }>();
  for (const catalog of catalogs) {
    if (catalog.collection !== "LOOPs") continue;
    const entry = map.get(catalog.sliceType) ?? { catalogCount: 0, sequenceCount: 0 };
    entry.catalogCount++;
    entry.sequenceCount += catalog.totalSequences;
    map.set(catalog.sliceType, entry);
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
  footer: CardFooter = { center: "The Kinetic Alphabet" },
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
    sourceCatalogId: entry.sourceCatalogId,
    stepCount: entry.stepCount,
    word: entry.word,
    position: i + 1,
    footer,
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
    sourceCatalogId: replacement.sourceCatalogId,
    stepCount: replacement.stepCount,
    word: replacement.word,
    position: card.position,
    footer: card.footer,
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
// TnD deck helpers
// ---------------------------------------------------------------------------

export interface TnDSequenceEntry {
  sequenceId: string;
  sourceCatalogId: string;
  turnRatio: string;
  turnPattern: string;
}

export interface TnDFamilyOption {
  familyId: string;
  label: string;
  sequenceCount: number;
  entries: readonly TnDSequenceEntry[];
}

function parseTurnRatio(deckName: string): string {
  const match = deckName.match(/\((\d+:\d+)/);
  return match?.[1] ?? "0:1";
}

export function getTnDFamilyOptions(catalogs: Catalog[]): TnDFamilyOption[] {
  const merged = new Map<string, { label: string; entries: TnDSequenceEntry[] }>();
  for (const catalog of catalogs) {
    if (catalog.collection !== "TnD") continue;
    const turnRatio = parseTurnRatio(catalog.name);
    for (const family of catalog.families) {
      if (!family.id || family.id === "unknown") continue;
      const existing = merged.get(family.id);
      const newEntries = family.sequenceIds.map(id => ({ sequenceId: id, sourceCatalogId: catalog.id, turnRatio, turnPattern: catalog.turnPattern }));
      if (existing) {
        existing.entries.push(...newEntries);
      } else {
        merged.set(family.id, { label: family.label, entries: newEntries });
      }
    }
  }
  for (const [, data] of merged) {
    const seen = new Set<string>();
    data.entries = data.entries.filter(e => {
      if (seen.has(e.sequenceId)) return false;
      seen.add(e.sequenceId);
      return true;
    });
  }

  return [...merged.entries()].map(([id, { label, entries }]) => ({
    familyId: id,
    label,
    sequenceCount: entries.length,
    entries,
  }));
}

export function tndFooter(familyId: string, _turnRatio: string): CardFooter {
  const theme = TND_BY_FAMILY[familyId];
  return theme
    ? { center: theme.name, iconPath: theme.iconPath }
    : { center: familyId };
}

export interface TnDTurnPatternOption {
  turnPattern: string;
  label: string;
  sequenceCount: number;
}

export function getTnDTurnPatternOptions(catalogs: Catalog[]): TnDTurnPatternOption[] {
  const counts = new Map<string, number>();
  for (const catalog of catalogs) {
    if (catalog.collection !== "TnD") continue;
    const tp = catalog.turnPattern;
    counts.set(tp, (counts.get(tp) ?? 0) + catalog.totalSequences);
  }
  return [...counts.entries()]
    .map(([tp, count]) => ({ turnPattern: tp, label: formatTurnPatternLabel(tp), sequenceCount: count }))
    .sort((a, b) => parseTurnPatternSort(a.turnPattern) - parseTurnPatternSort(b.turnPattern));
}

function formatTurnPatternLabel(tp: string): string {
  const uniform = tp.match(/^uniform[- ](\d+(?:\.\d+)?)t$/i);
  if (uniform) return `${uniform[1]}T`;
  const pipe = tp.match(/^(\d+(?:\.\d+)?)\|(\d+(?:\.\d+)?)$/);
  if (pipe) return `${pipe[1]}|${pipe[2]}`;
  return tp;
}

function parseTurnPatternSort(tp: string): number {
  const uniform = tp.match(/^uniform[- ](\d+(?:\.\d+)?)t$/i);
  if (uniform) return parseFloat(uniform[1]!);
  const pipe = tp.match(/^(\d+(?:\.\d+)?)\|(\d+(?:\.\d+)?)$/);
  if (pipe) return parseFloat(pipe[1]!) * 10 + parseFloat(pipe[2]!);
  return 999;
}

export function buildTnDCards(
  tndFamilies: TnDFamilyOption[],
  selectedFamilies: Set<string>,
  selectedTurnPatterns?: Set<string>,
): DeckReleaseCard[] {
  const cards: DeckReleaseCard[] = [];
  for (const fam of tndFamilies) {
    if (!selectedFamilies.has(fam.familyId)) continue;
    for (const entry of fam.entries) {
      if (selectedTurnPatterns && !selectedTurnPatterns.has(entry.turnPattern)) continue;
      cards.push({
        sequenceId: entry.sequenceId,
        sourceCatalogId: entry.sourceCatalogId,
        stepCount: 4,
        word: entry.sequenceId,
        position: 0,
        footer: tndFooter(fam.familyId, entry.turnRatio),
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
