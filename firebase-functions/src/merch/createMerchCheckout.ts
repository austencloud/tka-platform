import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import Stripe from "stripe";
import { defineString } from "firebase-functions/params";
import { buildMerchCheckoutParams } from "./checkoutParams";
import { resolveActivePriceId, isMisauthoredPastCutoff } from "./resolveActivePrice";
import {
  validateLoopConfig,
  SHOP_PROP_TYPES,
  type LoopConfigRequest,
} from "./loopConfigValidation";

const stripeSecretKey = defineString("STRIPE_SECRET_KEY");
const appBaseUrl = defineString("APP_BASE_URL", { default: "https://tkaflowarts.com" });

interface CheckoutRequest {
  productId: string;
  propType?: string;
  loopConfig?: LoopConfigRequest;
}

interface CheckoutResponse {
  url: string;
}

export const createMerchCheckout = functions.https.onCall(
  async (data: CheckoutRequest): Promise<CheckoutResponse> => {
    const { productId, propType, loopConfig } = data;

    if (!productId || typeof productId !== "string") {
      throw new functions.https.HttpsError("invalid-argument", "productId is required");
    }
    if (
      propType !== undefined &&
      !SHOP_PROP_TYPES.includes(propType as (typeof SHOP_PROP_TYPES)[number])
    ) {
      throw new functions.https.HttpsError("invalid-argument", "Unknown propType");
    }
    if (loopConfig !== undefined) validateLoopConfig(loopConfig);

    const stripe = new Stripe(stripeSecretKey.value());
    const productDoc = await admin.firestore().collection("products").doc(productId).get();
    if (!productDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Product not found");
    }
    const product = productDoc.data()!;
    if (product.status !== "active") {
      throw new functions.https.HttpsError(
        "failed-precondition", "Product is not available for purchase"
      );
    }
    const baseUrl = appBaseUrl.value();
    // Preorder → regular price gate. Evaluated with the SERVER clock so a client
    // can't force the cheaper preorder price after the cutoff has passed.
    const now = Date.now();
    const activePriceId = resolveActivePriceId(
      product as {
        stripePriceId: string;
        regularStripePriceId?: string;
        preorderPriceCutoff?: string;
      },
      now
    );
    if (isMisauthoredPastCutoff(product as { stripePriceId: string; preorderPriceCutoff?: string }, now)) {
      functions.logger.warn(
        `Product ${productId} is past its preorder cutoff but has no regularStripePriceId; ` +
          `charging the preorder price. Author the regular price in Stripe.`
      );
    }

    const session = await stripe.checkout.sessions.create(
      buildMerchCheckoutParams({
        product: { name: product.name as string, stripePriceId: activePriceId },
        productId,
        baseUrl,
        propType,
        loopConfig,
      })
    );
    if (!session.url) {
      throw new functions.https.HttpsError("internal", "Failed to create checkout session");
    }
    return { url: session.url };
  }
);
