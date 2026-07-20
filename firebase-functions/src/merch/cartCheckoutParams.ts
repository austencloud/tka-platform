import type Stripe from "stripe";
import { SHIPPING_COUNTRIES } from "./shippingCountries";

// Same PLACEHOLDER flat rates as checkoutParams.ts — one shipment per order.
const MERCH_SHIPPING_OPTIONS: Stripe.Checkout.SessionCreateParams.ShippingOption[] = [
  { shipping_rate_data: { type: "fixed_amount", display_name: "US shipping", tax_behavior: "exclusive", fixed_amount: { amount: 500, currency: "usd" } } },
  { shipping_rate_data: { type: "fixed_amount", display_name: "Canada shipping", tax_behavior: "exclusive", fixed_amount: { amount: 1400, currency: "usd" } } },
  { shipping_rate_data: { type: "fixed_amount", display_name: "International shipping", tax_behavior: "exclusive", fixed_amount: { amount: 2500, currency: "usd" } } },
];

export interface CartCheckoutLine {
  stripePriceId: string;
  quantity: number;
}

export function buildCartCheckoutParams(opts: {
  orderRef: string;
  baseUrl: string;
  lineItems: CartCheckoutLine[];
}): Stripe.Checkout.SessionCreateParams {
  const { orderRef, baseUrl, lineItems } = opts;
  return {
    mode: "payment",
    payment_method_types: ["card"],
    line_items: lineItems.map((l) => ({ price: l.stripePriceId, quantity: l.quantity })),
    automatic_tax: { enabled: true },
    shipping_address_collection: { allowed_countries: SHIPPING_COUNTRIES },
    shipping_options: MERCH_SHIPPING_OPTIONS,
    success_url: `${baseUrl}/shop/success?session_id={CHECKOUT_SESSION_ID}`,
    // Cart checkout has no single product to cancel back to — return to the shop.
    cancel_url: `${baseUrl}/shop`,
    metadata: { orderRef },
  };
}
