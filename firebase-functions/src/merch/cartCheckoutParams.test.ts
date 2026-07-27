import { buildCartCheckoutParams } from "./cartCheckoutParams";

describe("buildCartCheckoutParams", () => {
  const base = {
    orderRef: "order_abc",
    baseUrl: "https://tkaflowarts.com",
    lineItems: [
      { stripePriceId: "price_deck", quantity: 1 },
      { stripePriceId: "price_poster", quantity: 3 },
    ],
    freeUsShipping: true,
  };

  it("emits one Stripe line item per cart line, preserving quantity", () => {
    const p = buildCartCheckoutParams(base);
    expect(p.line_items).toEqual([
      { price: "price_deck", quantity: 1 },
      { price: "price_poster", quantity: 3 },
    ]);
  });

  it("carries ONLY orderRef in metadata (no per-item cram)", () => {
    const p = buildCartCheckoutParams(base);
    expect(p.metadata).toEqual({ orderRef: "order_abc" });
  });

  it("enables automatic tax and explicit card payments", () => {
    const p = buildCartCheckoutParams(base);
    expect(p.automatic_tax).toEqual({ enabled: true });
    expect(p.payment_method_types).toEqual(["card"]);
  });

  it("collects worldwide shipping with tax behavior and the shipping tax code", () => {
    const p = buildCartCheckoutParams(base);
    expect((p.shipping_address_collection?.allowed_countries ?? []).length).toBeGreaterThan(100);
    for (const o of p.shipping_options ?? []) {
      expect(o.shipping_rate_data?.tax_behavior).toBe("exclusive");
      expect(o.shipping_rate_data?.tax_code).toBe("txcd_92010001");
    }
  });

  it("keeps US shipping free when a deck price already includes it", () => {
    const p = buildCartCheckoutParams(base);
    const us = (p.shipping_options ?? []).find(
      (option) => option.shipping_rate_data?.display_name === "Free US shipping"
    );
    expect(us?.shipping_rate_data?.fixed_amount?.amount).toBe(0);
  });

  it("charges US shipping for carts without a shipping-inclusive product", () => {
    const p = buildCartCheckoutParams({ ...base, freeUsShipping: false });
    const us = (p.shipping_options ?? []).find(
      (option) => option.shipping_rate_data?.display_name === "US shipping"
    );
    expect(us?.shipping_rate_data?.fixed_amount?.amount).toBe(500);
  });

  it("builds success + cancel urls from baseUrl (cancel returns to cart)", () => {
    const p = buildCartCheckoutParams(base);
    expect(p.success_url).toBe(
      "https://tkaflowarts.com/shop/success?session_id={CHECKOUT_SESSION_ID}"
    );
    expect(p.cancel_url).toBe("https://tkaflowarts.com/shop");
  });
});
