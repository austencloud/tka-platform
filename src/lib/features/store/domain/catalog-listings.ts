import type { Product } from "./models/product";
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

/** Where this product is bought. Anything without a bespoke listing page falls
 *  through to the generic detail route. */
export function productHref(product: Product): string {
  const route = product.listing ? LISTING_ROUTES[product.listing] : undefined;
  return route ? route.href : `/shop/${product.id}`;
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
  /** True when the entry covers several SKUs at different prices, so the price
   *  reads "from $30" instead of claiming one exact number. */
  readonly priceIsFrom: boolean;
  /** Lowest-sortOrder SKU in the group — the one whose cover art and preorder
   *  status represent the entry. */
  readonly product: Product;
}

/** Collapse a product list into storefront entries, cheapest-first inside each
 *  group and in catalog order between them. */
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
    const prices = sorted.map((p) => activePriceCents(p, now));
    const lowest = Math.min(...prices);
    const listingName = lead.listing ? LISTING_ROUTES[lead.listing]?.name : undefined;
    entries.push({
      href,
      name: listingName ?? lead.name,
      shelf: shelfLabel(lead),
      blurb: lead.description,
      priceCents: lowest,
      priceIsFrom: prices.some((cents) => cents !== lowest),
      product: lead,
    });
  }

  return entries.sort((a, b) => a.product.sortOrder - b.product.sortOrder);
}

export interface CrossSellOptions {
  /** The product being viewed. Its whole listing group drops out of the rail. */
  readonly currentProductId?: string;
  /** The page the rail is rendered on, when it isn't derivable from a product
   *  (the success page passes nothing and gets the full line). */
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
  const { currentProductId, currentHref, limit = 3 } = options;
  const current = currentProductId
    ? products.find((p) => p.id === currentProductId)
    : undefined;
  const excludeHref = currentHref ?? (current ? productHref(current) : undefined);
  return deriveCatalogEntries(products)
    .filter((entry) => entry.href !== excludeHref)
    .slice(0, limit);
}
