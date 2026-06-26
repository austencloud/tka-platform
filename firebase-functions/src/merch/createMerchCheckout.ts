import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import Stripe from "stripe";
import { defineString } from "firebase-functions/params";
import { buildMerchCheckoutParams } from "./checkoutParams";

const stripeSecretKey = defineString("STRIPE_SECRET_KEY");
const appBaseUrl = defineString("APP_BASE_URL", { default: "https://tkaflowarts.com" });

interface CheckoutRequest {
  productId: string;
}

interface CheckoutResponse {
  url: string;
}

export const createMerchCheckout = functions.https.onCall(
  async (data: CheckoutRequest): Promise<CheckoutResponse> => {
    const { productId } = data;

    if (!productId || typeof productId !== "string") {
      throw new functions.https.HttpsError("invalid-argument", "productId is required");
    }

    const stripe = new Stripe(stripeSecretKey.value());

    const productDoc = await admin.firestore().collection("products").doc(productId).get();

    if (!productDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Product not found");
    }

    const product = productDoc.data()!;

    if (product.status !== "active") {
      throw new functions.https.HttpsError("failed-precondition", "Product is not available for purchase");
    }

    const baseUrl = appBaseUrl.value();

    const session = await stripe.checkout.sessions.create(
      buildMerchCheckoutParams({ product: product as { name: string; stripePriceId: string }, productId, baseUrl })
    );

    if (!session.url) {
      throw new functions.https.HttpsError("internal", "Failed to create checkout session");
    }

    return { url: session.url };
  }
);
