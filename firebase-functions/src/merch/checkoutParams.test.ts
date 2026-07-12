import { buildMerchCheckoutParams } from "./checkoutParams";

const PRODUCT = { name: "Deck", stripePriceId: "price_123" };

describe("buildMerchCheckoutParams", () => {
  const params = buildMerchCheckoutParams({
    product: PRODUCT,
    productId: "doc_1",
    baseUrl: "https://tkaflowarts.com",
  });

  it("enables Stripe automatic tax", () => {
    expect(params.automatic_tax).toEqual({ enabled: true });
  });

  it("uses the product's stripePriceId as the single line item", () => {
    expect(params.line_items).toEqual([{ price: "price_123", quantity: 1 }]);
  });

  it("collects worldwide shipping addresses", () => {
    const countries = params.shipping_address_collection?.allowed_countries ?? [];
    expect(countries).toContain("US");
    expect(countries).toContain("AU");
    expect(countries.length).toBeGreaterThan(100);
  });

  it("offers shipping rates that all declare a tax_behavior (required by automatic_tax)", () => {
    const opts = params.shipping_options ?? [];
    expect(opts.length).toBeGreaterThanOrEqual(3);
    for (const o of opts) {
      expect(o.shipping_rate_data?.tax_behavior).toBe("exclusive");
    }
  });

  it("builds /shop success + cancel urls from baseUrl", () => {
    expect(params.success_url).toBe(
      "https://tkaflowarts.com/shop/success?session_id={CHECKOUT_SESSION_ID}"
    );
    expect(params.cancel_url).toBe("https://tkaflowarts.com/shop/doc_1");
  });

  it("omits propType from metadata when the buyer didn't pick one", () => {
    expect(params.metadata).toEqual({ productId: "doc_1", productName: "Deck" });
  });

  it("flattens loopConfig into string metadata (Stripe metadata is string-only)", () => {
    const withLoop = buildMerchCheckoutParams({
      product: PRODUCT,
      productId: "doc_1",
      baseUrl: "https://tkaflowarts.com",
      propType: "staff",
      loopConfig: {
        level: "mix",
        length: "8",
        flavor: "variety",
        custom: { levelBalance: "even" },
      },
    });
    expect(withLoop.metadata).toEqual({
      productId: "doc_1",
      productName: "Deck",
      propType: "staff",
      loopLevel: "mix",
      loopLength: "8",
      loopFlavor: "variety",
      loopCustom: JSON.stringify({ levelBalance: "even" }),
    });
  });

  it("omits loopCustom when the advanced panel was untouched", () => {
    const withLoop = buildMerchCheckoutParams({
      product: PRODUCT,
      productId: "doc_1",
      baseUrl: "https://tkaflowarts.com",
      loopConfig: { level: "1", length: "8", flavor: "rotated" },
    });
    expect(withLoop.metadata?.loopCustom).toBeUndefined();
    expect(withLoop.metadata?.loopFlavor).toBe("rotated");
  });

  it("writes only loopPack for pack orders (pack XOR dials)", () => {
    const withPack = buildMerchCheckoutParams({
      product: PRODUCT,
      productId: "doc_1",
      baseUrl: "https://tkaflowarts.com",
      propType: "staff",
      loopConfig: { pack: "mild" },
    });
    expect(withPack.metadata).toEqual({
      productId: "doc_1",
      productName: "Deck",
      propType: "staff",
      loopPack: "mild",
    });
  });

  it("encodes a Deck Architect recipe compactly (metadata 500-char cap)", () => {
    const withRecipe = buildMerchCheckoutParams({
      product: PRODUCT,
      productId: "doc_1",
      baseUrl: "https://tkaflowarts.com",
      propType: "club",
      loopConfig: {
        recipe: [
          { count: 27, flavor: "rotated", level: 1, steps: 8 },
          { count: 14, flavor: "rotated", level: 2, steps: 12, maxTurns: 1 },
          { count: 13, flavor: "mirrored-swapped", level: 3, steps: 16, maxTurns: 1.5 },
        ],
      },
    });
    expect(withRecipe.metadata).toEqual({
      productId: "doc_1",
      productName: "Deck",
      propType: "club",
      loopRecipe: "27:rotated:1:8;14:rotated:2:12:1;13:mirrored-swapped:3:16:1.5",
    });
    expect(withRecipe.metadata?.loopLevel).toBeUndefined();
  });

  it("carries the buyer's propType in metadata for the webhook", () => {
    const withProp = buildMerchCheckoutParams({
      product: PRODUCT,
      productId: "doc_1",
      baseUrl: "https://tkaflowarts.com",
      propType: "club",
    });
    expect(withProp.metadata).toEqual({
      productId: "doc_1",
      productName: "Deck",
      propType: "club",
    });
  });
});
