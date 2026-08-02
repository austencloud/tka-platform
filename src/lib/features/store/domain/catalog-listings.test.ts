import { describe, it, expect } from "vitest";
import type { Product } from "./models/product";
import { productHref, deriveCatalogEntries, deriveCrossSell } from "./catalog-listings";

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    name: "Product",
    description: "",
    type: "physical-deck",
    price: 3500,
    stripePriceId: "price_live",
    status: "active",
    previewImageUrls: [],
    sortOrder: 0,
    ...overrides,
  };
}

const LOOP_FLAVOR = product({ id: "loop-a", listing: "loop-deck", price: 3500, sortOrder: 1 });
const LOOP_CUSTOM = product({
  id: "loop-custom",
  listing: "loop-deck-custom",
  price: 4000,
  sortOrder: 2,
});
const TND_ONE = product({
  id: "tnd-1",
  name: "TKA 1: Learning Letters",
  listing: "tnd-trilogy",
  price: 3000,
  sortOrder: 5,
});
const TND_TWO = product({
  id: "tnd-2",
  name: "TKA 2: One Turn",
  listing: "tnd-trilogy",
  price: 3000,
  sortOrder: 6,
});
const GUIDE = product({ id: "guide", type: "guide", name: "Level 1 Guide", sortOrder: 9 });

const CATALOG = [LOOP_FLAVOR, LOOP_CUSTOM, TND_ONE, TND_TWO, GUIDE];

describe("productHref", () => {
  it("sends both LOOP listings to the one configurator a buyer sees", () => {
    expect(productHref(LOOP_FLAVOR)).toBe("/shop/loop-deck");
    expect(productHref(LOOP_CUSTOM)).toBe("/shop/loop-deck");
  });

  it("falls through to the generic detail route for one-off SKUs", () => {
    expect(productHref(GUIDE)).toBe("/shop/guide");
  });
});

describe("deriveCatalogEntries", () => {
  it("collapses SKUs that share a page into one shelf entry", () => {
    const entries = deriveCatalogEntries(CATALOG);
    expect(entries.map((e) => e.href)).toEqual([
      "/shop/loop-deck",
      "/shop/tnd-trilogy",
      "/shop/guide",
    ]);
  });

  it("names a grouped listing after the listing, not its first SKU", () => {
    const tnd = deriveCatalogEntries(CATALOG).find((e) => e.href === "/shop/tnd-trilogy");
    expect(tnd?.name).toBe("Timing & Direction");
  });

  it("prices a mixed group from its cheapest SKU and says so", () => {
    const loop = deriveCatalogEntries(CATALOG).find((e) => e.href === "/shop/loop-deck");
    expect(loop?.priceCents).toBe(3500);
    expect(loop?.priceIsFrom).toBe(true);
  });

  it("does not claim 'from' when every SKU in the group costs the same", () => {
    const tnd = deriveCatalogEntries(CATALOG).find((e) => e.href === "/shop/tnd-trilogy");
    expect(tnd?.priceIsFrom).toBe(false);
  });

  it("leaves out drafts and sold-out stock", () => {
    const entries = deriveCatalogEntries([...CATALOG, product({ id: "hidden", status: "draft" })]);
    expect(entries.some((e) => e.href === "/shop/hidden")).toBe(false);
  });
});

describe("deriveCrossSell", () => {
  it("drops the whole listing group the shopper is already looking at", () => {
    const entries = deriveCrossSell(CATALOG, { currentProductId: LOOP_CUSTOM.id });
    expect(entries.map((e) => e.href)).toEqual(["/shop/tnd-trilogy", "/shop/guide"]);
  });

  it("shows the full line when nothing is being viewed (the success page)", () => {
    expect(deriveCrossSell(CATALOG)).toHaveLength(3);
  });

  it("respects the limit", () => {
    expect(deriveCrossSell(CATALOG, { limit: 1 })).toHaveLength(1);
  });
});
