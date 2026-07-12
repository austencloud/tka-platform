import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import Stripe from "stripe";
import { defineString } from "firebase-functions/params";
import { mapStripeProductToDoc } from "./productSync";

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
          // Buyer's print prop for physical decks; absent = staff (also absent
          // on pre-prop-picker orders and non-deck items).
          ...(session.metadata.propType && { propType: session.metadata.propType }),
          // Curated LOOP pack — the recipe id fulfillment resolves against
          // LOOP_PACKS (client loop-config.ts). Pack XOR dials.
          ...(session.metadata.loopPack && { loopPack: session.metadata.loopPack }),
          // LOOP configurator dials (flat strings; loopCustom = JSON of the
          // advanced-panel choices). Absent on non-LOOP items.
          ...(session.metadata.loopLevel && {
            loopLevel: session.metadata.loopLevel,
            loopLength: session.metadata.loopLength || "",
            loopFlavor: session.metadata.loopFlavor || "",
            ...(session.metadata.loopCustom && { loopCustom: session.metadata.loopCustom }),
          }),
          quantity: 1,
          // Per-unit product price = the line-item subtotal (single quantity),
          // BEFORE shipping + tax. amount_total includes the flat shipping rate
          // and automatic_tax, so using it here inflated every order's recorded
          // unitPrice. totalAmount below is correctly the grand total.
          unitPrice: session.amount_subtotal || 0,
        }],
        totalAmount: session.amount_total || 0,
        status: "paid",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await admin.firestore().collection("orders").add(order);
      console.log(`Order created for product ${session.metadata.productId}`);
    }

    // Product sync: the Stripe Dashboard is the product editor. When a product is
    // created/edited there, mirror it into Firestore so the storefront + the
    // public createMerchCheckout (which reads products/{id}.stripePriceId) keep
    // working unchanged. TKA-specific fields ride in Stripe product metadata.
    if (event.type === "product.created" || event.type === "product.updated") {
      const product = event.data.object as Stripe.Product;
      // merge: preserve stripePriceId/price set by price.* events (any order).
      await admin
        .firestore()
        .collection("products")
        .doc(product.id)
        .set(mapStripeProductToDoc(product), { merge: true });
      console.log(`Synced product ${product.id} (${product.name})`);
    }

    // Price sync: attach the active price to its product doc so checkout can use it.
    if (event.type === "price.created" || event.type === "price.updated") {
      const price = event.data.object as Stripe.Price;
      const productId =
        typeof price.product === "string" ? price.product : price.product.id;
      if (price.active) {
        await admin
          .firestore()
          .collection("products")
          .doc(productId)
          .set({ stripePriceId: price.id, price: price.unit_amount ?? 0 }, { merge: true });
        console.log(`Synced price ${price.id} -> product ${productId}`);
      }
    }

    res.status(200).send("OK");
  }
);
