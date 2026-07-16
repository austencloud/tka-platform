import { describe, it, expect } from "vitest";
import type { Product } from "./models/product";
import {
  preorderWindowOpen,
  activePriceCents,
  formatUsd,
  cutoffLabel,
} from "./preorder-pricing";

const CUTOFF = "2026-09-30T23:59:59-05:00";
const CUTOFF_MS = Date.parse(CUTOFF);

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    name: "Deck",
    description: "",
    type: "physical-deck",
    price: 3500,
    stripePriceId: "price_preorder",
    status: "active",
    previewImageUrls: [],
    sortOrder: 0,
    regularStripePriceId: "price_regular",
    regularPrice: 4500,
    preorderPriceCutoff: CUTOFF,
    ...overrides,
  };
}

describe("activePriceCents", () => {
  it("preorder price before the cutoff", () => {
    expect(activePriceCents(product(), CUTOFF_MS - 1)).toBe(3500);
  });

  it("regular price at/after the cutoff", () => {
    expect(activePriceCents(product(), CUTOFF_MS)).toBe(4500);
    expect(activePriceCents(product(), CUTOFF_MS + 1)).toBe(4500);
  });

  it("evergreen product (no cutoff) always shows its base price", () => {
    const p = product({ preorderPriceCutoff: undefined, regularPrice: undefined });
    expect(activePriceCents(p, CUTOFF_MS + 1)).toBe(3500);
  });

  it("falls back to preorder when regular price is missing", () => {
    const p = product({ regularPrice: undefined, regularStripePriceId: undefined });
    expect(activePriceCents(p, CUTOFF_MS + 1)).toBe(3500);
  });
});

describe("preorderWindowOpen", () => {
  it("open before the cutoff when a regular price exists", () => {
    expect(preorderWindowOpen(product(), CUTOFF_MS - 1)).toBe(true);
  });

  it("closed at/after the cutoff", () => {
    expect(preorderWindowOpen(product(), CUTOFF_MS)).toBe(false);
  });

  it("closed for an evergreen product (no note to show)", () => {
    expect(preorderWindowOpen(product({ preorderPriceCutoff: undefined }), 0)).toBe(false);
  });

  it("closed when no regular price is authored yet", () => {
    expect(preorderWindowOpen(product({ regularPrice: undefined }), 0)).toBe(false);
  });
});

describe("formatUsd", () => {
  it("whole dollars from cents", () => {
    expect(formatUsd(3500)).toBe("$35");
    expect(formatUsd(5500)).toBe("$55");
  });

  it("shows cents when the price isn't a whole dollar amount", () => {
    expect(formatUsd(3250)).toBe("$32.50");
    expect(formatUsd(999)).toBe("$9.99");
  });
});

describe("cutoffLabel", () => {
  it("formats the cutoff in Chicago time as a friendly date", () => {
    expect(cutoffLabel(CUTOFF)).toBe("September 30");
  });

  it("empty string on missing or unparseable input", () => {
    expect(cutoffLabel(undefined)).toBe("");
    expect(cutoffLabel("nope")).toBe("");
  });
});
