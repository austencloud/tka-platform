import { describe, it, expect } from "vitest";
import type { Product } from "./models/product";
import { resolvePurchaseState, purchaseCtaLabel } from "./purchase-state";

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    name: "LOOP Deck",
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

describe("resolvePurchaseState", () => {
  it("offers nothing but notify while the shop cannot charge", () => {
    expect(resolvePurchaseState(product(), false)).toBe("notify");
    expect(resolvePurchaseState(product({ preorder: true }), false)).toBe("notify");
  });

  it("buys a live, priced, active product once sales are on", () => {
    expect(resolvePurchaseState(product(), true)).toBe("buy");
  });

  it("distinguishes a pre-order from a buy", () => {
    expect(resolvePurchaseState(product({ preorder: true }), true)).toBe("preorder");
  });

  it("falls back to notify without a Stripe price", () => {
    expect(resolvePurchaseState(product({ stripePriceId: "" }), true)).toBe("notify");
  });

  it("falls back to notify for drafts and sold-out SKUs", () => {
    expect(resolvePurchaseState(product({ status: "draft" }), true)).toBe("notify");
    expect(resolvePurchaseState(product({ status: "sold-out" }), true)).toBe("notify");
  });
});

describe("purchaseCtaLabel", () => {
  it("says pre-order on the button, not after checkout", () => {
    expect(purchaseCtaLabel("preorder")).toBe("Pre-order now");
    expect(purchaseCtaLabel("preorder", "add")).toBe("Add pre-order to cart");
  });

  it("keeps the plain buy wording otherwise", () => {
    expect(purchaseCtaLabel("buy")).toBe("Buy now");
    expect(purchaseCtaLabel("buy", "add")).toBe("Add to cart");
  });
});
