import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import Stripe from "stripe";
import { defineString } from "firebase-functions/params";
import { buildCartCheckoutParams, type CartCheckoutLine } from "./cartCheckoutParams";
import {
  validateLoopConfig,
  SHOP_PROP_TYPES,
  type LoopConfigRequest,
} from "./loopConfigValidation";

const stripeSecretKey = defineString("STRIPE_SECRET_KEY");
const appBaseUrl = defineString("APP_BASE_URL", { default: "https://tkaflowarts.com" });

const PENDING_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CART_ITEMS = 20;

interface CartItemRequest {
  productId: string;
  quantity: number;
  propType?: string;
  loopConfig?: LoopConfigRequest;
}

interface CartCheckoutRequest {
  items: CartItemRequest[];
}

interface CheckoutResponse {
  url: string;
}

export const createCartCheckout = functions.https.onCall(
  async (data: CartCheckoutRequest): Promise<CheckoutResponse> => {
    const items = data?.items;
    if (!Array.isArray(items) || items.length === 0) {
      throw new functions.https.HttpsError("invalid-argument", "Cart is empty");
    }
    if (items.length > MAX_CART_ITEMS) {
      throw new functions.https.HttpsError("invalid-argument", "Too many items in cart");
    }

    const db = admin.firestore();

    // Resolve every line server-side: price + status come from the product doc,
    // never the client. Validate any LOOP config with the shared validators.
    const lineItems: CartCheckoutLine[] = [];
    const orderLines: Record<string, unknown>[] = [];
    let subtotal = 0;

    for (const item of items) {
      if (!item?.productId || typeof item.productId !== "string") {
        throw new functions.https.HttpsError("invalid-argument", "Line missing productId");
      }
      const qty = item.quantity;
      if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
        throw new functions.https.HttpsError("invalid-argument", "Bad line quantity");
      }
      if (
        item.propType !== undefined &&
        !SHOP_PROP_TYPES.includes(item.propType as (typeof SHOP_PROP_TYPES)[number])
      ) {
        throw new functions.https.HttpsError("invalid-argument", "Unknown propType");
      }
      const isLoopDeck = item.loopConfig !== undefined;
      if (isLoopDeck) {
        validateLoopConfig(item.loopConfig as LoopConfigRequest);
        if (qty !== 1) {
          throw new functions.https.HttpsError("invalid-argument", "Configured decks are qty 1");
        }
      }

      const snap = await db.collection("products").doc(item.productId).get();
      if (!snap.exists) {
        throw new functions.https.HttpsError("not-found", `Product ${item.productId} not found`);
      }
      const product = snap.data()!;
      if (product.status !== "active") {
        throw new functions.https.HttpsError(
          "failed-precondition", `Product ${item.productId} is not available`
        );
      }
      const stripePriceId = product.stripePriceId as string;
      const unitPrice = (product.price as number) ?? 0;
      if (!stripePriceId) {
        throw new functions.https.HttpsError(
          "failed-precondition", `Product ${item.productId} has no price`
        );
      }

      lineItems.push({ stripePriceId, quantity: qty });
      subtotal += unitPrice * qty;
      orderLines.push({
        kind: isLoopDeck ? "loopDeck" : "sku",
        productId: item.productId,
        stripePriceId,
        name: product.name ?? "",
        unitPrice,
        qty,
        ...(item.propType && { propType: item.propType }),
        ...(isLoopDeck && { loopConfig: item.loopConfig }),
      });
    }

    // Write the pending order BEFORE Stripe so the webhook has a doc to flip.
    const now = admin.firestore.Timestamp.now();
    const expiresAt = admin.firestore.Timestamp.fromMillis(now.toMillis() + PENDING_TTL_MS);
    const orderRef = db.collection("orders").doc();
    await orderRef.set({
      status: "pending",
      lineItems: orderLines,
      subtotal,
      createdAt: now,
      expiresAt,
    });

    const stripe = new Stripe(stripeSecretKey.value());
    const session = await stripe.checkout.sessions.create(
      buildCartCheckoutParams({
        orderRef: orderRef.id,
        baseUrl: appBaseUrl.value(),
        lineItems,
      })
    );
    if (!session.url) {
      throw new functions.https.HttpsError("internal", "Failed to create checkout session");
    }
    await orderRef.update({ stripeSessionId: session.id });
    return { url: session.url };
  }
);
