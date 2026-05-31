/**
 * parity-deck-source
 *
 * Loads a REAL released deck's cards for the parity harness — base sequences
 * resolved from the catalog, frozen card variations applied, footers + TnD
 * elements aligned per card. Reuses the same resolvers the deck releaser uses
 * (loadSequencesByIds + applyVariationDescriptor + loadDiamondEdges) so the
 * harness renders exactly what production renders, on real data.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type { CardFooter, DeckRelease } from "../domain/models/DeckRelease";
import type { TnDElement } from "../domain/tnd-element";
import { getAllReleases } from "./deck-release-store";
import { loadSequencesByIds } from "./catalog-loader";
import { applyVariationDescriptor } from "./deck-variation";
import { loadDiamondEdges } from "./pictograph-letter-lookup";
import { getTnDElementByIconPath } from "../domain/tnd-element";

export interface ParityDeckCard {
  sequence: SequenceData;
  word: string;
  footer: CardFooter;
  tndElement: TnDElement | undefined;
}

export interface ParityDeck {
  deckNumber: number;
  name: string;
  theme: string;
  bluePropType: PropType;
  redPropType: PropType;
  cards: ParityDeckCard[];
}

export interface ParityDeckSummary {
  deckNumber: number;
  name: string;
}

/** All released decks, newest first, as lightweight picker summaries. */
export async function listParityDecks(): Promise<ParityDeckSummary[]> {
  const releases = await getAllReleases();
  return releases.map((r) => ({
    deckNumber: r.deckNumber,
    name: r.name ?? `Deck ${r.deckNumber}`,
  }));
}

/**
 * Load one released deck's first `limit` cards as renderable tuples. When
 * `deckNumber` is omitted, the newest released deck is used. Returns null when
 * no decks are released.
 */
export async function loadParityDeck(
  deckNumber?: number,
  limit = 8,
): Promise<ParityDeck | null> {
  const releases = await getAllReleases();
  if (releases.length === 0) return null;

  // getAllReleases sorts newest-first; default to the newest.
  const release: DeckRelease =
    (deckNumber != null && releases.find((r) => r.deckNumber === deckNumber)) ||
    releases[0]!;

  const cards = release.sequences.slice(0, limit);

  // Group sequence ids per source catalog, load each catalog's bases once.
  const byCatalog = new Map<string, Set<string>>();
  for (const c of cards) {
    const set = byCatalog.get(c.sourceCatalogId) ?? new Set<string>();
    set.add(c.sequenceId);
    byCatalog.set(c.sourceCatalogId, set);
  }
  const baseByKey = new Map<string, SequenceData>();
  for (const [catalogId, ids] of byCatalog) {
    const seqs = await loadSequencesByIds(catalogId, [...ids]);
    for (const s of seqs) baseByKey.set(`${catalogId}::${s.id}`, s);
  }

  const edges = await loadDiamondEdges();

  // Resolve per-card so footer + element stay aligned with each sequence
  // (resolveDeckSequences drops missing bases, which would misalign them).
  const out: ParityDeckCard[] = [];
  for (const card of cards) {
    const base = baseByKey.get(`${card.sourceCatalogId}::${card.sequenceId}`);
    if (!base) continue;
    const sequence = card.variation
      ? applyVariationDescriptor(base, card.variation, edges).sequence
      : base;
    const tndElement = card.footer?.iconPath
      ? getTnDElementByIconPath(card.footer.iconPath) ?? undefined
      : undefined;
    out.push({ sequence, word: card.word, footer: card.footer, tndElement });
  }

  return {
    deckNumber: release.deckNumber,
    name: release.name ?? `Deck ${release.deckNumber}`,
    theme: release.theme,
    bluePropType: (release.bluePropType ?? "staff") as PropType,
    redPropType: (release.redPropType ?? "staff") as PropType,
    cards: out,
  };
}
