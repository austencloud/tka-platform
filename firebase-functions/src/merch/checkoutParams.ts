import type Stripe from "stripe";
import { SHIPPING_COUNTRIES } from "./shippingCountries";
import { buildMerchShippingOptions } from "./shippingOptions";

// Flat shipping rates (USD cents). The buyer selects one at checkout — Stripe does
// not auto-pick a rate by destination in a static session. US shipping is FREE
// (baked into the deck price); Canada/International stay paid because those rates
// (~$14 / ~$25 for a <1lb ~128-card deck) would erase the margin if absorbed.

export interface MerchCheckoutProduct {
  name: string;
  stripePriceId: string;
}

export function buildMerchCheckoutParams(opts: {
  product: MerchCheckoutProduct;
  productId: string;
  baseUrl: string;
  /** Buyer's print prop (validated PropType value). Rides in metadata so the
   *  webhook writes it onto the order for fulfillment. */
  propType?: string;
  /** Validated LOOP configurator selection. Stripe metadata is string-only:
   *  a pack order writes loopPack; a custom order flattens to
   *  loopLevel/loopLength/loopFlavor (+ loopCustom JSON when the advanced
   *  panel was touched). Pack XOR dials — enforced by createMerchCheckout. */
  loopConfig?: {
    pack?: string;
    recipe?: Array<{
      count?: number;
      flavor?: string;
      level?: number;
      steps?: number;
      maxTurns?: number;
    }>;
    level?: string;
    length?: string;
    flavor?: string;
    custom?: Record<string, unknown>;
  };
}): Stripe.Checkout.SessionCreateParams {
  const { product, productId, baseUrl, propType, loopConfig } = opts;
  // Compact wire format (Stripe metadata values cap at 500 chars):
  // count:flavor:level:steps[:turns] per slice, ";"-joined. Mirrors
  // encodeRecipe in the client's loop-config.ts.
  const loopRecipe = loopConfig?.recipe
    ?.map((s) =>
      [s.count, s.flavor, s.level, s.steps, ...(s.maxTurns !== undefined ? [s.maxTurns] : [])].join(":")
    )
    .join(";");
  return {
    mode: "payment",
    // Explicit: the live account has no dashboard-default payment methods
    // configured, and Checkout refuses a session with none ("No valid
    // payment method types"). Card is universally enabled.
    payment_method_types: ["card"],
    line_items: [{ price: product.stripePriceId, quantity: 1 }],
    automatic_tax: { enabled: true },
    shipping_address_collection: { allowed_countries: SHIPPING_COUNTRIES },
    shipping_options: buildMerchShippingOptions({ freeUsShipping: true }),
    success_url: `${baseUrl}/shop/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/shop/${productId}`,
    metadata: {
      productId,
      productName: product.name,
      ...(propType && { propType }),
      ...(loopConfig?.pack && { loopPack: loopConfig.pack }),
      ...(loopRecipe && { loopRecipe }),
      ...(loopConfig &&
        !loopConfig.pack &&
        !loopConfig.recipe && {
          loopLevel: loopConfig.level ?? "",
          loopLength: loopConfig.length ?? "",
          loopFlavor: loopConfig.flavor ?? "",
          ...(loopConfig.custom && { loopCustom: JSON.stringify(loopConfig.custom) }),
        }),
    },
  };
}
