import type { CoverCard, Product } from "./models/product";
import { activePriceCents } from "./preorder-pricing";

/**
 * How raw product SKUs collapse into the storefront entries a shopper sees.
 *
 * Several SKUs can be one thing on the shelf: the three Timing & Direction
 * volumes are one listing, and the LOOP deck's flavor SKUs plus its custom SKU
 * are one configurator. A shopper should see "Timing & Direction", not three
 * near-identical rows, so everything that groups SKUs into shelf entries and
 * points them at their page lives here — the cross-sell rail and the catalog
 * front door both read from it.
 */

interface ListingRoute {
  readonly href: string;
  readonly name: string;
}

/** `product.listing` values, mapped to the page that sells them. Two LOOP
 *  listings share one page on purpose: the flavor SKUs and the custom SKU are
 *  the same configurator to a buyer. */
const LISTING_ROUTES: Record<string, ListingRoute> = {
  "loop-deck": { href: "/shop/loop-deck", name: "LOOP Deck" },
  "loop-deck-custom": { href: "/shop/loop-deck", name: "LOOP Deck" },
  "loop-deck-architect": { href: "/shop/loop-deck/architect", name: "Deck Architect" },
  "tnd-trilogy": { href: "/shop/tnd-trilogy", name: "Timing & Direction" },
  "starter-pack": { href: "/shop/starter-pack", name: "Starter Pack" },
};

/** The LOOP card line. The Deck Architect prints from this same set, so it
 *  borrows these covers when it has none of its own. */
const LOOP_LINE_LISTING = "loop-deck";
const TRILOGY_LISTING = "tnd-trilogy";

/** Where this product is bought. Anything without a bespoke listing page falls
 *  through to the generic detail route. */
export function productHref(product: Product): string {
  const route = product.listing ? LISTING_ROUTES[product.listing] : undefined;
  return route ? route.href : `/shop/${product.id}`;
}

/** The page a whole listing sells from, without needing one of its SKUs in
 *  hand. Lets a page exclude itself from its own cross-sell rail by naming the
 *  listing it IS, rather than guessing an id or retyping its own URL. */
export function listingHref(listing: string): string | undefined {
  return LISTING_ROUTES[listing]?.href;
}

/** Shelf display order. The printed decks are the flagship shelf and lead;
 *  the bundle is a way to buy several of them, so it reads last. Anything
 *  unlisted sorts after the known shelves in catalog order. */
const SHELF_ORDER = ["Deck", "Book", "Bundle", "Digital", "Merch"];

export function shelfRank(shelf: string): number {
  const i = SHELF_ORDER.indexOf(shelf);
  return i === -1 ? SHELF_ORDER.length : i;
}

/** The shelf a product belongs to — the kicker above its name, and the filter
 *  chips on the catalog front door. Only shelves with real products exist. */
export function shelfLabel(product: Product): string {
  switch (product.type) {
    case "physical-deck":
      return "Deck";
    case "sampler-pack":
      return "Bundle";
    case "guide":
      return "Book";
    case "digital":
      return "Digital";
    default:
      return "Merch";
  }
}

/** One storefront entry: a page, its art, and what it costs. */
export interface CatalogEntry {
  /** Stable key: the page it links to, which is what makes an entry unique. */
  readonly href: string;
  readonly name: string;
  readonly shelf: string;
  readonly blurb: string;
  readonly priceCents: number;
  /** True when the entry covers several BUYABLE SKUs at different prices, so
   *  the price reads "from $30" instead of claiming one exact number. */
  readonly priceIsFrom: boolean;
  /** Lowest-sortOrder SKU in the group — the one whose cover art, copy, and
   *  shelf represent the entry. */
  readonly product: Product;
  /** The SKU the entry's OFFER speaks for: availability, preorder, status.
   *  A cover-only row (no `stripePriceId`) can lead a group on sortOrder while
   *  the SKU that carries the price sits behind it — the LOOP deck's flavor
   *  rows are exactly that. Reading availability off the lead then said
   *  "In stock" for a row nobody can buy, next to a price taken from a
   *  different SKU. Buyable SKUs answer that question; a group with none of
   *  them falls back to the lead. */
  readonly offer: Product;
  /** Real printed card fronts this entry's art box fans. Empty means the art
   *  falls back to a cover image or the printed guide's cover. */
  readonly artCards: readonly CoverCard[];
}

function coversOf(products: readonly Product[]): CoverCard[] {
  const withCovers = products.filter((p) => p.coverCards?.length);
  // Several SKUs behind one entry: show one card each, so the fan reads as the
  // variety on offer instead of six near-identical cards from one deck.
  if (withCovers.length > 1) {
    return withCovers.flatMap((p) => p.coverCards?.slice(0, 1) ?? []);
  }
  return withCovers[0]?.coverCards ? [...withCovers[0].coverCards] : [];
}

function lineCovers(products: readonly Product[], listing: string): CoverCard[] {
  return coversOf(products.filter((p) => p.listing === listing));
}

/**
 * The cards an entry fans.
 *
 * Real cards from the entry's own SKUs whenever they exist. The two entries
 * that ship no cover cards of their own still show what a buyer receives: the
 * bundle fans a mixed hand of the cards in its box, and the Deck Architect
 * fans the LOOP line it prints from. Anything else gets no fan — the art falls
 * back to a cover image or a plain mark rather than borrowing art that
 * misrepresents it.
 */
function artCardsFor(
  lead: Product,
  group: readonly Product[],
  products: readonly Product[]
): CoverCard[] {
  const own = coversOf(group);
  if (own.length) return own;

  if (lead.type === "sampler-pack") {
    const loop = lineCovers(products, LOOP_LINE_LISTING).slice(0, 3);
    const trilogy = lineCovers(products, TRILOGY_LISTING).slice(0, 3);
    return [...loop, ...trilogy];
  }
  if (lead.type === "physical-deck") {
    return lineCovers(products, LOOP_LINE_LISTING);
  }
  return [];
}

/**
 * Display price for a group.
 *
 * A SKU with no `stripePriceId` cannot be bought — it is catalog/cover data,
 * not an offer. Quoting one as the headline price advertises a number nobody
 * can pay: the LOOP deck read "from $25" off six flavor rows that exist only
 * to carry cover art, while the one buyable SKU was $35. Buyable SKUs set the
 * price; a group with none of them (nothing is published to Stripe yet) still
 * shows its list price rather than nothing at all.
 */
function groupPrice(group: readonly Product[], now: number): {
  cents: number;
  isFrom: boolean;
} {
  const buyable = group.filter((p) => p.stripePriceId);
  const priced = buyable.length > 0 ? buyable : group;
  const prices = priced.map((p) => activePriceCents(p, now));
  const lowest = Math.min(...prices);
  return { cents: lowest, isFrom: prices.some((cents) => cents !== lowest) };
}

/**
 * Collapse a product list into storefront entries, cheapest-first inside each
 * group and in catalog order between them.
 *
 * A product with no `listing` gets its own storefront entry, which is right for
 * a one-off like the book and wrong for a leftover Stripe-synced SKU that
 * duplicates a real listing by name (today: a second "LOOP Deck" doc with no
 * listing field). Two identical entries is never the correct shelf, so the
 * listing-routed entry wins and the unlisted twin drops out — here, in the one
 * derivation, so the front door and every cross-sell rail inherit it.
 */
export function deriveCatalogEntries(products: readonly Product[]): CatalogEntry[] {
  const groups = new Map<string, Product[]>();
  for (const product of products) {
    if (product.status !== "active") continue;
    const href = productHref(product);
    const group = groups.get(href);
    if (group) group.push(product);
    else groups.set(href, [product]);
  }

  const now = Date.now();
  const entries: CatalogEntry[] = [];
  for (const [href, group] of groups) {
    const sorted = [...group].sort((a, b) => a.sortOrder - b.sortOrder);
    const lead = sorted[0];
    if (!lead) continue;
    const listingName = lead.listing ? LISTING_ROUTES[lead.listing]?.name : undefined;
    const { cents, isFrom } = groupPrice(sorted, now);
    // Same rule the price already follows (groupPrice): an offer comes from a
    // SKU that can actually be charged.
    const offer = sorted.find((p) => p.stripePriceId) ?? lead;
    entries.push({
      href,
      name: listingName ?? lead.name,
      shelf: shelfLabel(lead),
      blurb: lead.description,
      priceCents: cents,
      priceIsFrom: isFrom,
      product: lead,
      offer,
      artCards: artCardsFor(lead, sorted, products),
    });
  }

  const listedNames = new Set(
    entries.filter((e) => e.product.listing).map((e) => e.name)
  );
  return entries
    .filter((e) => e.product.listing || !listedNames.has(e.name))
    .sort((a, b) => a.product.sortOrder - b.product.sortOrder);
}

export interface CrossSellOptions {
  /** The product being viewed. Its whole listing group drops out of the rail. */
  readonly currentProductId?: string;
  /** The listing this page IS. The most robust handle a host has: it survives
   *  a SKU swap and can't disagree with the route the way a hand-typed href
   *  can (the Deck Architect used to name the LOOP deck's href and so sold
   *  itself back to the reader). */
  readonly currentListing?: string;
  /** The page the rail is rendered on, when it isn't derivable from a product
   *  or a listing (the success page passes nothing and gets the full line). */
  readonly currentHref?: string;
  readonly limit?: number;
}

/**
 * "More from the line" — every other storefront entry, minus the one already on
 * screen. No new backend: this is the same `loadActiveProducts()` list the page
 * already holds, regrouped.
 */
export function deriveCrossSell(
  products: readonly Product[],
  options: CrossSellOptions = {}
): CatalogEntry[] {
  const { currentProductId, currentListing, currentHref, limit = 3 } = options;
  const current = currentProductId
    ? products.find((p) => p.id === currentProductId)
    : undefined;
  const excludeHref =
    currentHref ??
    (currentListing ? listingHref(currentListing) : undefined) ??
    (current ? productHref(current) : undefined);
  return deriveCatalogEntries(products)
    .filter((entry) => entry.href !== excludeHref)
    .slice(0, limit);
}
