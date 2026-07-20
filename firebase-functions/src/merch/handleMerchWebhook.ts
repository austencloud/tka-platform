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
      const shippingDetails = session.collected_information?.shipping_details;
      const shippingAddress = shippingDetails?.address
        ? {
            name: shippingDetails.name || "",
            line1: shippingDetails.address.line1 || "",
            line2: shippingDetails.address.line2 || "",
            city: shippingDetails.address.city || "",
            state: shippingDetails.address.state || "",
            postalCode: shippingDetails.address.postal_code || "",
            country: shippingDetails.address.country || "",
          }
        : null;

      // NEW spine: the order doc already exists (pending), created by
      // createCartCheckout. Flip it to paid and attach Stripe fields. Clear
      // expiresAt so the Firestore TTL policy never reaps a paid order.
      if (session.metadata?.orderRef) {
        const orderRef = admin.firestore().collection("orders").doc(session.metadata.orderRef);
        await orderRef.set(
          {
            status: "paid",
            stripePaymentIntentId: session.payment_intent as string,
            customerEmail: session.customer_details?.email || "",
            shippingAddress,
            totalAmount: session.amount_total || 0,
            paidAt: admin.firestore.FieldValue.serverTimestamp(),
            expiresAt: admin.firestore.FieldValue.delete(),
          },
          { merge: true }
        );
        console.log(`Order ${session.metadata.orderRef} marked paid`);
        res.status(200).send("OK");
        return;
      }

      // LEGACY path: single-product orders whose config rode in metadata.
      // Kept for in-flight sessions created before the cart cutover; remove
      // once no legacy sessions remain (see plan Task 12).
      if (!session.metadata?.productId) {
        res.status(200).send("Not a merch checkout, skipping");
        return;
      }
      const order = {
        stripeSessionId: session.id,
        stripePaymentIntentId: session.payment_intent as string,
        customerEmail: session.customer_details?.email || "",
        shippingAddress,
        items: [{
          productId: session.metadata.productId,
          productName: session.metadata.productName || "",
          ...(session.metadata.propType && { propType: session.metadata.propType }),
          ...(session.metadata.loopPack && { loopPack: session.metadata.loopPack }),
          ...(session.metadata.loopRecipe && { loopRecipe: session.metadata.loopRecipe }),
          ...(session.metadata.loopLevel && {
            loopLevel: session.metadata.loopLevel,
            loopLength: session.metadata.loopLength || "",
            loopFlavor: session.metadata.loopFlavor || "",
            ...(session.metadata.loopCustom && { loopCustom: session.metadata.loopCustom }),
          }),
          quantity: 1,
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
    // A deck carries TWO active prices — preorder and regular — distinguished by
    // Stripe price metadata.tier. Route each to its own field so the second price
    // does NOT clobber the first (the old single-field write did). Untagged prices
    // are treated as preorder (back-compat with pre-swap products).
    if (event.type === "price.created" || event.type === "price.updated") {
      const price = event.data.object as Stripe.Price;
      const productId =
        typeof price.product === "string" ? price.product : price.product.id;
      if (price.active) {
        const tier = price.metadata?.tier;
        const patch =
          tier === "regular"
            ? { regularStripePriceId: price.id, regularPrice: price.unit_amount ?? 0 }
            : { stripePriceId: price.id, price: price.unit_amount ?? 0 };
        await admin
          .firestore()
          .collection("products")
          .doc(productId)
          .set(patch, { merge: true });
        console.log(`Synced ${tier ?? "preorder"} price ${price.id} -> product ${productId}`);
      }
    }

    res.status(200).send("OK");
  }
);
