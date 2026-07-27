import * as admin from "firebase-admin";
import Stripe from "stripe";
import { createCartCheckoutHandler } from "./createCartCheckout";

const CUTOFF = "2026-09-30T23:59:59-05:00";
const AFTER_CUTOFF = Date.parse(CUTOFF) + 1;

describe("createCartCheckoutHandler", () => {
  it("writes a server-priced pending order before opening Stripe Checkout", async () => {
    const orderSet = jest.fn().mockResolvedValue(undefined);
    const orderUpdate = jest.fn().mockResolvedValue(undefined);
    const orderDoc = { id: "order_123", set: orderSet, update: orderUpdate };
    const productGet = jest.fn().mockResolvedValue({
      exists: true,
      data: () => ({
        name: "LOOP Deck",
        status: "active",
        type: "physical-deck",
        stripePriceId: "price_preorder",
        price: 3500,
        regularStripePriceId: "price_regular",
        regularPrice: 4500,
        preorderPriceCutoff: CUTOFF,
      }),
    });
    const db = {
      collection: jest.fn((name: string) =>
        name === "products"
          ? { doc: () => ({ get: productGet }) }
          : { doc: () => orderDoc }
      ),
    } as unknown as admin.firestore.Firestore;
    const stripeCreate = jest.fn().mockResolvedValue({
      id: "cs_live_123",
      url: "https://checkout.stripe.com/example",
    });
    const stripe = {
      checkout: { sessions: { create: stripeCreate } },
    } as unknown as Stripe;

    const result = await createCartCheckoutHandler(
      {
        items: [
          {
            productId: "deck",
            quantity: 1,
            propType: "staff",
            loopConfig: { pack: "mild" },
          },
        ],
      },
      {
        db,
        stripe,
        baseUrl: "https://tkaflowarts.com",
        nowMs: AFTER_CUTOFF,
      }
    );

    expect(result.url).toBe("https://checkout.stripe.com/example");
    expect(orderSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "pending",
        subtotal: 4500,
        lineItems: [
          expect.objectContaining({
            productId: "deck",
            stripePriceId: "price_regular",
            unitPrice: 4500,
            qty: 1,
          }),
        ],
      })
    );
    expect(orderSet.mock.invocationCallOrder[0]).toBeLessThan(
      stripeCreate.mock.invocationCallOrder[0]
    );

    const checkoutParams = stripeCreate.mock.calls[0][0];
    expect(checkoutParams.line_items).toEqual([
      { price: "price_regular", quantity: 1 },
    ]);
    expect(checkoutParams.metadata).toEqual({ orderRef: "order_123" });
    expect(checkoutParams.shipping_options[0].shipping_rate_data).toEqual(
      expect.objectContaining({
        display_name: "Free US shipping",
        tax_code: "txcd_92010001",
        fixed_amount: { amount: 0, currency: "usd" },
      })
    );
    expect(orderUpdate).toHaveBeenCalledWith({ stripeSessionId: "cs_live_123" });
  });
});
