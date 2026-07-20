import { buildCartCheckoutParams } from "./cartCheckoutParams";

describe("buildCartCheckoutParams", () => {
  const base = {
    orderRef: "order_abc",
    baseUrl: "https://tkaflowarts.com",
    lineItems: [
      { stripePriceId: "price_deck", quantity: 1 },
      { stripePriceId: "price_poster", quantity: 3 },
    ],
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

  it("collects worldwide shipping with tax_behavior on every rate", () => {
    const p = buildCartCheckoutParams(base);
    expect((p.shipping_address_collection?.allowed_countries ?? []).length).toBeGreaterThan(100);
    for (const o of p.shipping_options ?? []) {
      expect(o.shipping_rate_data?.tax_behavior).toBe("exclusive");
    }
  });

  it("builds success + cancel urls from baseUrl (cancel returns to cart)", () => {
    const p = buildCartCheckoutParams(base);
    expect(p.success_url).toBe(
      "https://tkaflowarts.com/shop/success?session_id={CHECKOUT_SESSION_ID}"
    );
    expect(p.cancel_url).toBe("https://tkaflowarts.com/shop");
  });
});
