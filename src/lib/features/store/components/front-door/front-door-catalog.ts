import type { CoverCard, Product } from "../../domain/models/product";

/**
 * The catalog front door's view of the product list.
 *
 * Which entries exist, what they cost, and what art each one shows all come
 * from `catalog-listings.ts` — every storefront surface reads the same
 * derivation, so the front door and the cross-sell rails cannot disagree about
 * the catalog. What is left here is the two questions only this page asks:
 * how a shelf is worded on a filter chip, and which single card the hero holds.
 */

/** Chip wording for a shelf. `shelfLabel` names one item ("Deck"); a filter
 *  chip names the group. */
export function shelfChipLabel(shelf: string): string {
  return shelf === "Merch" ? "Merch" : `${shelf}s`;
}

/**
 * The card the hero holds up.
 *
 * A baked cover comes back from Storage at full print resolution, which is the
 * only render that carries the card's real, scannable QR — on-screen preview
 * renders skip the QR entirely. So a baked card wins; if none is baked yet the
 * hero still shows a real card, just without the code. It never shows an
 * invented QR pattern.
 */
export function heroCoverCard(products: readonly Product[]): CoverCard | null {
  const cards = products
    .filter((p) => p.status === "active")
    .flatMap((p) => p.coverCards ?? []);
  const baked = cards.find((c) => c.imageUrl || c.propImageUrls);
  return baked ?? cards[0] ?? null;
}

/** Every cover on the page, for the one worker seed that lets fans compose with
 *  their arrow/prop/glyph assets present. */
export function allCoverCards(products: readonly Product[]): CoverCard[] {
  return products.flatMap((p) => p.coverCards ?? []);
}
