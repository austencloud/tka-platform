import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { CardFooter } from "$lib/features/choreo-card/domain/models/DeckRelease";
import type { ResolvedDeckSequence } from "$lib/features/choreo-card/services/deck-variation";
import { TURN_VALUES } from "$lib/features/choreo-card/domain/turn-pattern-parser";

/** Matches deck-composer's formatTurn: integers bare, halves as X.0/X.5. */
function formatTurn(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/** The full 7x7 = 49 blue|red turn patterns. */
export function allTurnPatterns(): string[] {
  const out: string[] = [];
  for (const blue of TURN_VALUES) {
    for (const red of TURN_VALUES) {
      out.push(`${formatTurn(blue)}|${formatTurn(red)}`);
    }
  }
  return out;
}

/** A base seed plus its resolved sequence per turn pattern. */
export interface SeedMatrix {
  seedId: string;
  word: string;
  footer: CardFooter;
  byTurn: Map<string, SequenceData>;
}

/** Minimal card shape this grouping needs (subset of DeckReleaseCard). */
export interface GroupableCard {
  sequenceId: string;
  word: string;
  footer: CardFooter;
  variation?: { turnPattern?: string };
}

/**
 * Zip cards to their positionally-resolved sequences (resolveDeckSequences
 * preserves order and never drops when bases are present), then bucket by seed
 * id and turn pattern. Seed order follows first appearance in `cards`.
 */
export function groupCardsBySeed(
  cards: GroupableCard[],
  resolved: ResolvedDeckSequence[],
): SeedMatrix[] {
  const bySeed = new Map<string, SeedMatrix>();
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i]!;
    const res = resolved[i];
    if (!res) continue;
    let entry = bySeed.get(card.sequenceId);
    if (!entry) {
      entry = { seedId: card.sequenceId, word: card.word, footer: card.footer, byTurn: new Map() };
      bySeed.set(card.sequenceId, entry);
    }
    const tp = card.variation?.turnPattern ?? "0|0";
    entry.byTurn.set(tp, res.sequence);
  }
  return [...bySeed.values()];
}
