import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import Stripe from "stripe";
import { defineString } from "firebase-functions/params";

const stripeSecretKey = defineString("STRIPE_SECRET_KEY");
const stripeWebhookSecret = defineString("STRIPE_WEBHOOK_SECRET");

export const handleMerchWebhook = functions.https.onRequest(
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const sig = req.headers["stripe-signature"];
    if (!sig) {
      res.status(400).send("Missing stripe-signature header");
      return;
    }

    let event: Stripe.Event;

    try {
      const stripe = new Stripe(stripeSecretKey.value());
      event = stripe.webhooks.constructEvent(req.rawBody, sig, stripeWebhookSecret.value());
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      res.status(400).send("Webhook signature verification failed");
      return;
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      if (!session.metadata?.productId) {
        res.status(200).send("Not a merch checkout, skipping");
        return;
      }

      // In Stripe SDK v21, shipping details are under collected_information
      const shippingDetails = session.collected_information?.shipping_details;

      const order = {
        stripeSessionId: session.id,
        stripePaymentIntentId: session.payment_intent as string,
        customerEmail: session.customer_details?.email || "",
        shippingAddress: shippingDetails?.address
          ? {
              name: shippingDetails.name || "",
              line1: shippingDetails.address.line1 || "",
              line2: shippingDetails.address.line2 || "",
              city: shippingDetails.address.city || "",
              state: shippingDetails.address.state || "",
              postalCode: shippingDetails.address.postal_code || "",
              country: shippingDetails.address.country || "",
            }
          : null,
        items: [{
          productId: session.metadata.productId,
          productName: session.metadata.productName || "",
          quantity: 1,
          unitPrice: session.amount_total || 0,
        }],
        totalAmount: session.amount_total || 0,
        status: "paid",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await admin.firestore().collection("orders").add(order);
      console.log(`Order created for product ${session.metadata.productId}`);
    }

    res.status(200).send("OK");
  }
);
