import type Stripe from "stripe";
import { SHIPPING_COUNTRIES } from "./shippingCountries";

// PLACEHOLDER flat shipping rates (USD cents). The buyer selects one at checkout —
// Stripe does not auto-pick a rate by destination in a static session. Tune these
// once real package weight is measured (a ~128-card deck is <1lb: US ~$5, Canada
// ~$14, international ~$25). tax_behavior is required when automatic_tax is enabled.
const MERCH_SHIPPING_OPTIONS: Stripe.Checkout.SessionCreateParams.ShippingOption[] = [
  { shipping_rate_data: { type: "fixed_amount", display_name: "US shipping", tax_behavior: "exclusive", fixed_amount: { amount: 500, currency: "usd" } } },
  { shipping_rate_data: { type: "fixed_amount", display_name: "Canada shipping", tax_behavior: "exclusive", fixed_amount: { amount: 1400, currency: "usd" } } },
  { shipping_rate_data: { type: "fixed_amount", display_name: "International shipping", tax_behavior: "exclusive", fixed_amount: { amount: 2500, currency: "usd" } } },
];

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
    level?: string;
    length?: string;
    flavor?: string;
    custom?: Record<string, unknown>;
  };
}): Stripe.Checkout.SessionCreateParams {
  const { product, productId, baseUrl, propType, loopConfig } = opts;
  return {
    mode: "payment",
    line_items: [{ price: product.stripePriceId, quantity: 1 }],
    automatic_tax: { enabled: true },
    shipping_address_collection: { allowed_countries: SHIPPING_COUNTRIES },
    shipping_options: MERCH_SHIPPING_OPTIONS,
    success_url: `${baseUrl}/shop/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/shop/${productId}`,
    metadata: {
      productId,
      productName: product.name,
      ...(propType && { propType }),
      ...(loopConfig?.pack && { loopPack: loopConfig.pack }),
      ...(loopConfig &&
        !loopConfig.pack && {
          loopLevel: loopConfig.level ?? "",
          loopLength: loopConfig.length ?? "",
          loopFlavor: loopConfig.flavor ?? "",
          ...(loopConfig.custom && { loopCustom: JSON.stringify(loopConfig.custom) }),
        }),
    },
  };
}
