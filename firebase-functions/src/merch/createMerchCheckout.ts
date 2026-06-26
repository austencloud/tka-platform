import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import Stripe from "stripe";
import { defineString } from "firebase-functions/params";
import { SHIPPING_COUNTRIES } from "./shippingCountries";

const stripeSecretKey = defineString("STRIPE_SECRET_KEY");
const appBaseUrl = defineString("APP_BASE_URL", { default: "https://tkaflowarts.com" });

// PLACEHOLDER flat shipping rates (USD cents). The buyer selects one at checkout —
// Stripe does not auto-pick a rate by destination in a static session. Tune these
// once real package weight is measured (a ~128-card deck is <1lb: US ~$5, Canada
// ~$14, international ~$25). Amounts here are reasonable launch placeholders.
const MERCH_SHIPPING_OPTIONS: Stripe.Checkout.SessionCreateParams.ShippingOption[] = [
  { shipping_rate_data: { type: "fixed_amount", display_name: "US shipping", fixed_amount: { amount: 500, currency: "usd" } } },
  { shipping_rate_data: { type: "fixed_amount", display_name: "Canada shipping", fixed_amount: { amount: 1400, currency: "usd" } } },
  { shipping_rate_data: { type: "fixed_amount", display_name: "International shipping", fixed_amount: { amount: 2500, currency: "usd" } } },
];

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

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: product.stripePriceId, quantity: 1 }],
      shipping_address_collection: { allowed_countries: SHIPPING_COUNTRIES },
      shipping_options: MERCH_SHIPPING_OPTIONS,
      success_url: `${baseUrl}/shop/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/shop/${productId}`,
      metadata: { productId, productName: product.name },
    });

    if (!session.url) {
      throw new functions.https.HttpsError("internal", "Failed to create checkout session");
    }

    return { url: session.url };
  }
);
