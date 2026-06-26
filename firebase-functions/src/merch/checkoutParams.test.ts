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
});
