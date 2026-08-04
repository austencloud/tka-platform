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
  return heroCoverPool(products)[0]?.card ?? null;
}

/** A card the hero can hold up, with the product it belongs to (the product
 *  carries QR attribution and the deck name the print path stamps). */
export interface HeroCoverEntry {
  readonly card: CoverCard;
  readonly product: Product;
}

/**
 * Every card the hero could deal, best first.
 *
 * The hero used to hold ONE card forever, which made its second scan a repeat
 * of its first. Dealing a different card is the payoff, and the deck it deals
 * from is this: the active catalog's covers, already loaded, no generation at
 * runtime. Baked covers come first for the same reason `heroCoverCard` picked
 * one — only a baked render carries the card's real, scannable QR — and the
 * unbaked remainder still follows, so a shuffle keeps finding new cards after
 * the baked ones run out rather than dead-ending.
 */
export function heroCoverPool(products: readonly Product[]): HeroCoverEntry[] {
  const entries = products
    .filter((p) => p.status === "active")
    .flatMap((p) => (p.coverCards ?? []).map((card) => ({ card, product: p })));
  const isBaked = (e: HeroCoverEntry) =>
    !!(e.card.imageUrl || e.card.propImageUrls);
  return [...entries.filter(isBaked), ...entries.filter((e) => !isBaked(e))];
}

/** Every cover on the page, for the one worker seed that lets fans compose with
 *  their arrow/prop/glyph assets present. */
export function allCoverCards(products: readonly Product[]): CoverCard[] {
  return products.flatMap((p) => p.coverCards ?? []);
}
