import type Stripe from "stripe";
import { SHIPPING_COUNTRIES } from "./shippingCountries";
import { buildMerchShippingOptions } from "./shippingOptions";

export interface CartCheckoutLine {
  stripePriceId: string;
  quantity: number;
}

export function buildCartCheckoutParams(opts: {
  orderRef: string;
  baseUrl: string;
  lineItems: CartCheckoutLine[];
  freeUsShipping: boolean;
}): Stripe.Checkout.SessionCreateParams {
  const { orderRef, baseUrl, lineItems, freeUsShipping } = opts;
  return {
    mode: "payment",
    payment_method_types: ["card"],
    line_items: lineItems.map((l) => ({ price: l.stripePriceId, quantity: l.quantity })),
    automatic_tax: { enabled: true },
    shipping_address_collection: { allowed_countries: SHIPPING_COUNTRIES },
    shipping_options: buildMerchShippingOptions({ freeUsShipping }),
    success_url: `${baseUrl}/shop/success?session_id={CHECKOUT_SESSION_ID}`,
    // Cart checkout has no single product to cancel back to — return to the shop.
    cancel_url: `${baseUrl}/shop`,
    metadata: { orderRef },
  };
}
