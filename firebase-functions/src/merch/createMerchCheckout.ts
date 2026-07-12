import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import Stripe from "stripe";
import { defineString } from "firebase-functions/params";
import { buildMerchCheckoutParams } from "./checkoutParams";

const stripeSecretKey = defineString("STRIPE_SECRET_KEY");
const appBaseUrl = defineString("APP_BASE_URL", { default: "https://tkaflowarts.com" });

interface LoopConfigRequest {
  level: string;
  length: string;
  flavor: string;
  custom?: {
    levelBalance?: string;
    excludeFlavors?: string[];
  };
}

interface CheckoutRequest {
  productId: string;
  /** Buyer's print prop for physical decks (PropType value). Optional;
   *  absent = staff. */
  propType?: string;
  /** LOOP configurator dials. Optional; only the LOOP deck listing sends it. */
  loopConfig?: LoopConfigRequest;
}

interface CheckoutResponse {
  url: string;
}

// Mirrors of the client whitelists (src/lib/features/store/domain/
// shop-prop-options.ts and loop-config.ts) — the client codebase can't be
// imported from the functions build. Keep in sync.
const SHOP_PROP_TYPES = ["staff", "club", "fan", "triad", "buugeng"] as const;
const LOOP_LEVELS = ["1", "2", "3", "mix"] as const;
const LOOP_LENGTHS = ["8", "12", "16", "mix"] as const;
const LOOP_FLAVORS = [
  "variety",
  "rotated",
  "mirrored",
  "flipped",
  "swapped",
  "inverted",
  "rewound",
  "mirrored-swapped",
  "mirrored-inverted",
  "mirrored-rotated",
  "rotated-swapped",
  "rotated-inverted",
  "swapped-inverted",
  "mirrored-swapped-inverted",
  "mirrored-inverted-rotated",
  "mirrored-rotated-swapped",
  "mirrored-rotated-inverted-swapped",
] as const;
const LEVEL_BALANCES = ["mostly-1", "even", "mostly-spicy"] as const;

function validateLoopConfig(cfg: LoopConfigRequest): void {
  const bad = (msg: string) => {
    throw new functions.https.HttpsError("invalid-argument", msg);
  };
  if (!LOOP_LEVELS.includes(cfg.level as never)) bad("Unknown loop level");
  if (!LOOP_LENGTHS.includes(cfg.length as never)) bad("Unknown loop length");
  if (!LOOP_FLAVORS.includes(cfg.flavor as never)) bad("Unknown loop flavor");
  if (cfg.custom) {
    if (
      cfg.custom.levelBalance !== undefined &&
      !LEVEL_BALANCES.includes(cfg.custom.levelBalance as never)
    )
      bad("Unknown level balance");
    if (cfg.custom.excludeFlavors !== undefined) {
      if (
        !Array.isArray(cfg.custom.excludeFlavors) ||
        cfg.custom.excludeFlavors.some((f) => !LOOP_FLAVORS.includes(f as never))
      )
        bad("Unknown excluded flavor");
    }
  }
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
      throw new functions.https.HttpsError("failed-precondition", "Product is not available for purchase");
    }

    const baseUrl = appBaseUrl.value();

    const session = await stripe.checkout.sessions.create(
      buildMerchCheckoutParams({
        product: product as { name: string; stripePriceId: string },
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
