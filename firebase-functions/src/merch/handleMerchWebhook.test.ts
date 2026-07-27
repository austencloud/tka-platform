import * as admin from "firebase-admin";
import Stripe from "stripe";
import { processMerchWebhookEvent } from "./handleMerchWebhook";

describe("processMerchWebhookEvent", () => {
  it("marks a pending cart order paid and clears its TTL field", async () => {
    const set = jest.fn().mockResolvedValue(undefined);
    const db = {
      collection: jest.fn(() => ({
        doc: () => ({ set }),
      })),
    } as unknown as admin.firestore.Firestore;
    const session = {
      id: "cs_live_123",
      metadata: { orderRef: "order_123" },
      payment_intent: "pi_123",
      customer_details: { email: "buyer@example.com" },
      collected_information: {
        shipping_details: {
          name: "Buyer",
          address: {
            line1: "1 Main St",
            line2: null,
            city: "Chicago",
            state: "IL",
            postal_code: "60601",
            country: "US",
          },
        },
      },
      amount_total: 3500,
    } as unknown as Stripe.Checkout.Session;
    const event = {
      type: "checkout.session.completed",
      data: { object: session },
    } as Stripe.Event;

    await processMerchWebhookEvent(event, db);

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "paid",
        stripePaymentIntentId: "pi_123",
        customerEmail: "buyer@example.com",
        shippingAddress: expect.objectContaining({
          city: "Chicago",
          state: "IL",
          country: "US",
        }),
        totalAmount: 3500,
        paidAt: expect.anything(),
        expiresAt: expect.anything(),
      }),
      { merge: true }
    );
  });
});
