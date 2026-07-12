import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import Stripe from "stripe";
import { defineString } from "firebase-functions/params";
import { buildMerchCheckoutParams } from "./checkoutParams";

const stripeSecretKey = defineString("STRIPE_SECRET_KEY");
const appBaseUrl = defineString("APP_BASE_URL", { default: "https://tkaflowarts.com" });

interface RecipeSliceRequest {
  count?: number;
  flavor?: string;
  level?: number;
  steps?: number;
  maxTurns?: number;
}

interface LoopConfigRequest {
  /** Curated pack id — when present, the pack recipe drives fulfillment and
   *  the dial fields are absent (pack XOR dials XOR recipe). */
  pack?: string;
  /** Deck Architect recipe: buyer-authored slices summing to exactly 54. */
  recipe?: RecipeSliceRequest[];
  level?: string;
  length?: string;
  flavor?: string;
  custom?: {
    /** Max turns per motion, 0–3 in half steps. Rides on every Level 2+ order. */
    maxTurns?: number;
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
// Curated pack ids (recipes live client-side in loop-config.ts LOOP_PACKS;
// fulfillment resolves the id against those constants).
const LOOP_PACKS = ["mild", "medium", "spicy"] as const;
// Deck Architect recipe bounds — mirrors loop-config.ts (DECK_SIZE etc).
const DECK_SIZE = 54;
const MAX_RECIPE_SLICES = 8;
const RECIPE_STEPS = [4, 8, 12, 16] as const;

function validateRecipe(slices: RecipeSliceRequest[], bad: (msg: string) => void): void {
  if (!Array.isArray(slices) || slices.length === 0) bad("Recipe needs at least one slice");
  if (slices.length > MAX_RECIPE_SLICES) bad("Too many recipe slices");
  let total = 0;
  for (const s of slices) {
    if (!Number.isInteger(s.count) || (s.count as number) < 1) bad("Bad slice count");
    total += s.count as number;
    if (
      typeof s.flavor !== "string" ||
      s.flavor === "variety" ||
      !LOOP_FLAVORS.includes(s.flavor as never)
    )
      bad("Unknown slice flavor");
    if (![1, 2, 3].includes(s.level as number)) bad("Bad slice level");
    if (!RECIPE_STEPS.includes(s.steps as never)) bad("Bad slice steps");
    if (s.level === 1) {
      if (s.maxTurns !== undefined) bad("Level 1 slices carry no turns");
    } else {
      const t = s.maxTurns;
      if (typeof t !== "number" || t < 0.5 || t > 3 || (t * 2) % 1 !== 0)
        bad("Bad slice turn ceiling");
      else if (s.level === 2 && t % 1 !== 0) bad("Half turns are Level 3 only");
    }
  }
  if (total !== DECK_SIZE) bad(`Recipe must total exactly ${DECK_SIZE} cards`);
}

function validateLoopConfig(cfg: LoopConfigRequest): void {
  const bad = (msg: string) => {
    throw new functions.https.HttpsError("invalid-argument", msg);
  };
  const dialsPresent =
    cfg.level !== undefined ||
    cfg.length !== undefined ||
    cfg.flavor !== undefined ||
    cfg.custom !== undefined;
  if (cfg.pack !== undefined) {
    // Pack XOR dials XOR recipe: a pack order carries nothing else.
    if (!LOOP_PACKS.includes(cfg.pack as never)) bad("Unknown loop pack");
    if (dialsPresent || cfg.recipe !== undefined) bad("Pack orders carry no dial fields");
    return;
  }
  if (cfg.recipe !== undefined) {
    if (dialsPresent) bad("Recipe orders carry no dial fields");
    validateRecipe(cfg.recipe, bad);
    return;
  }
  if (!LOOP_LEVELS.includes(cfg.level as never)) bad("Unknown loop level");
  if (!LOOP_LENGTHS.includes(cfg.length as never)) bad("Unknown loop length");
  if (!LOOP_FLAVORS.includes(cfg.flavor as never)) bad("Unknown loop flavor");
  if (cfg.custom) {
    if (cfg.custom.maxTurns !== undefined) {
      const t = cfg.custom.maxTurns;
      // Floor excludes 0: a Level 2+ deck capped at 0 turns is a Level 1 deck.
      if (typeof t !== "number" || t < 0.5 || t > 3 || (t * 2) % 1 !== 0)
        bad("Unknown max turns");
    }
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
