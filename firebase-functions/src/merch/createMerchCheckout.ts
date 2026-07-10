import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import Stripe from "stripe";
import { defineString } from "firebase-functions/params";
import { buildMerchCheckoutParams } from "./checkoutParams";

const stripeSecretKey = defineString("STRIPE_SECRET_KEY");
const appBaseUrl = defineString("APP_BASE_URL", { default: "https://tkaflowarts.com" });

interface CheckoutRequest {
  productId: string;
  /** Buyer's print prop for physical decks (PropType value). Optional;
   *  absent = staff. */
  propType?: string;
}

interface CheckoutResponse {
  url: string;
}

// Mirror of SHOP_PROP_OPTIONS (src/lib/features/store/domain/shop-prop-options.ts)
// — the client codebase can't be imported from the functions build. Keep in sync.
const SHOP_PROP_TYPES = ["staff", "club", "fan", "triad", "buugeng"] as const;

export const createMerchCheckout = functions.https.onCall(
  async (data: CheckoutRequest): Promise<CheckoutResponse> => {
    const { productId, propType } = data;

    if (!productId || typeof productId !== "string") {
      throw new functions.https.HttpsError("invalid-argument", "productId is required");
    }

    if (
      propType !== undefined &&
      !SHOP_PROP_TYPES.includes(propType as (typeof SHOP_PROP_TYPES)[number])
    ) {
      throw new functions.https.HttpsError("invalid-argument", "Unknown propType");
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
      buildMerchCheckoutParams({
        product: product as { name: string; stripePriceId: string },
        productId,
        baseUrl,
        propType,
      })
    );

    if (!session.url) {
      throw new functions.https.HttpsError("internal", "Failed to create checkout session");
    }

    return { url: session.url };
  }
);
