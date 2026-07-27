import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import Stripe from "stripe";
import { defineString } from "firebase-functions/params";
import { buildCartCheckoutParams, type CartCheckoutLine } from "./cartCheckoutParams";
import { isUsShippingIncludedProductType } from "./shippingOptions";
import {
  isMisauthoredPastCutoff,
  resolveActivePriceCents,
  resolveActivePriceId,
  type PriceGateProductWithAmounts,
} from "./resolveActivePrice";
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

export interface CartCheckoutRequest {
  items: CartItemRequest[];
}

interface CheckoutResponse {
  url: string;
}

export interface CartCheckoutDependencies {
  readonly db: admin.firestore.Firestore;
  readonly stripe: Stripe;
  readonly baseUrl: string;
  readonly nowMs: number;
}

export async function createCartCheckoutHandler(
  data: CartCheckoutRequest,
  dependencies: CartCheckoutDependencies
): Promise<CheckoutResponse> {
    const items = data?.items;
    if (!Array.isArray(items) || items.length === 0) {
      throw new functions.https.HttpsError("invalid-argument", "Cart is empty");
    }
    if (items.length > MAX_CART_ITEMS) {
      throw new functions.https.HttpsError("invalid-argument", "Too many items in cart");
    }

    const { db, stripe, baseUrl, nowMs } = dependencies;

    // Resolve every line server-side: price + status come from the product doc,
    // never the client. Validate any LOOP config with the shared validators.
    const lineItems: CartCheckoutLine[] = [];
    const orderLines: Record<string, unknown>[] = [];
    let subtotal = 0;
    let freeUsShipping = false;

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
      const preorderPriceId = product.stripePriceId as string;
      if (!preorderPriceId) {
        throw new functions.https.HttpsError(
          "failed-precondition", `Product ${item.productId} has no price`
        );
      }
      const priceGateProduct: PriceGateProductWithAmounts = {
        stripePriceId: preorderPriceId,
        price: (product.price as number) ?? 0,
        ...(product.regularStripePriceId && {
          regularStripePriceId: product.regularStripePriceId as string,
        }),
        ...(product.regularPrice !== undefined && {
          regularPrice: product.regularPrice as number,
        }),
        ...(product.preorderPriceCutoff && {
          preorderPriceCutoff: product.preorderPriceCutoff as string,
        }),
      };
      const stripePriceId = resolveActivePriceId(priceGateProduct, nowMs);
      const unitPrice = resolveActivePriceCents(priceGateProduct, nowMs);
      if (isMisauthoredPastCutoff(priceGateProduct, nowMs)) {
        functions.logger.warn(
          `Product ${item.productId} is past its preorder cutoff but has no ` +
            "regularStripePriceId; charging the preorder price."
        );
      }

      freeUsShipping ||= isUsShippingIncludedProductType(product.type);
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
    const now = admin.firestore.Timestamp.fromMillis(nowMs);
    const expiresAt = admin.firestore.Timestamp.fromMillis(now.toMillis() + PENDING_TTL_MS);
    const orderRef = db.collection("orders").doc();
    await orderRef.set({
      status: "pending",
      lineItems: orderLines,
      subtotal,
      createdAt: now,
      expiresAt,
    });

    const session = await stripe.checkout.sessions.create(
      buildCartCheckoutParams({
        orderRef: orderRef.id,
        baseUrl,
        lineItems,
        freeUsShipping,
      })
    );
    if (!session.url) {
      throw new functions.https.HttpsError("internal", "Failed to create checkout session");
    }
    await orderRef.update({ stripeSessionId: session.id });
    return { url: session.url };
}

export const createCartCheckout = functions.https.onCall(
  async (data: CartCheckoutRequest): Promise<CheckoutResponse> => {
    return createCartCheckoutHandler(data, {
      db: admin.firestore(),
      stripe: new Stripe(stripeSecretKey.value()),
      baseUrl: appBaseUrl.value(),
      nowMs: Date.now(),
    });
  }
);
