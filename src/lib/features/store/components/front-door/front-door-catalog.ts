import type { CoverCard, Product } from "../../domain/models/product";
import {
  deriveCatalogEntries,
  productHref,
  type CatalogEntry,
} from "../../domain/catalog-listings";

/**
 * The catalog front door's view of the product list.
 *
 * Everything about WHICH entries exist and what they cost comes from
 * `catalog-listings.ts` — this module only answers the two questions that page
 * has and the shared domain doesn't: which entries are real shelf items, and
 * what art each one shows.
 */

/** The LOOP card line. The Deck Architect prints from this same set, so it
 *  borrows these covers when it has none of its own. */
const LOOP_LINE_LISTING = "loop-deck";
const TRILOGY_LISTING = "tnd-trilogy";

/**
 * Shelf entries, minus backing SKUs.
 *
 * A product with no `listing` gets its own storefront entry, which is right for
 * a one-off like the book and wrong for a leftover Stripe-synced SKU that
 * duplicates a real listing by name (today: a second "LOOP Deck" doc with no
 * listing field). Two identical tiles is never the correct shelf, so the
 * listing-routed entry wins and the unlisted twin drops out.
 */
export function frontDoorEntries(products: readonly Product[]): CatalogEntry[] {
  const entries = deriveCatalogEntries(products);
  const listedNames = new Set(
    entries.filter((e) => e.product.listing).map((e) => e.name)
  );
  return entries.filter((e) => e.product.listing || !listedNames.has(e.name));
}

/** Chip wording for a shelf. `shelfLabel` names one item ("Deck"); a filter
 *  chip names the group. */
export function shelfChipLabel(shelf: string): string {
  return shelf === "Merch" ? "Merch" : `${shelf}s`;
}

/** Active products that live behind one storefront entry. */
function groupProducts(
  entry: CatalogEntry,
  products: readonly Product[]
): Product[] {
  return products.filter(
    (p) => p.status === "active" && productHref(p) === entry.href
  );
}

function coversOf(products: readonly Product[]): CoverCard[] {
  const withCovers = products.filter((p) => p.coverCards?.length);
  // Several SKUs behind one entry: show one card each, so the fan reads as the
  // variety on offer instead of six near-identical cards from one deck.
  if (withCovers.length > 1) {
    return withCovers.flatMap((p) => p.coverCards?.slice(0, 1) ?? []);
  }
  return withCovers[0]?.coverCards ? [...withCovers[0].coverCards!] : [];
}

function lineCovers(products: readonly Product[], listing: string): CoverCard[] {
  return coversOf(products.filter((p) => p.listing === listing));
}

/**
 * The cards a tile fans.
 *
 * Real cards from the entry's own SKUs whenever they exist. The two entries
 * that ship no cover cards of their own still show what a buyer receives: the
 * bundle fans a mixed hand of the cards in its box, and the Deck Architect
 * fans the LOOP line it prints from. Anything else gets no fan — the tile
 * falls back to its cover image or a plain mark rather than borrowing art that
 * misrepresents it.
 */
export function entryArtCards(
  entry: CatalogEntry,
  products: readonly Product[]
): CoverCard[] {
  const own = coversOf(groupProducts(entry, products));
  if (own.length) return own;

  if (entry.product.type === "sampler-pack") {
    const loop = lineCovers(products, LOOP_LINE_LISTING).slice(0, 3);
    const trilogy = lineCovers(products, TRILOGY_LISTING).slice(0, 3);
    return [...loop, ...trilogy];
  }
  if (entry.product.type === "physical-deck") {
    return lineCovers(products, LOOP_LINE_LISTING);
  }
  return [];
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
