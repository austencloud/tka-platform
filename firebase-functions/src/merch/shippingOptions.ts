import type Stripe from "stripe";

const SHIPPING_TAX_CODE = "txcd_92010001";

export function isUsShippingIncludedProductType(productType: unknown): boolean {
  return productType === "physical-deck" || productType === "sampler-pack";
}

export function buildMerchShippingOptions({
  freeUsShipping,
}: {
  freeUsShipping: boolean;
}): Stripe.Checkout.SessionCreateParams.ShippingOption[] {
  return [
    {
      shipping_rate_data: {
        type: "fixed_amount",
        display_name: freeUsShipping ? "Free US shipping" : "US shipping",
        tax_behavior: "exclusive",
        tax_code: SHIPPING_TAX_CODE,
        fixed_amount: { amount: freeUsShipping ? 0 : 500, currency: "usd" },
      },
    },
    {
      shipping_rate_data: {
        type: "fixed_amount",
        display_name: "Canada shipping",
        tax_behavior: "exclusive",
        tax_code: SHIPPING_TAX_CODE,
        fixed_amount: { amount: 1400, currency: "usd" },
      },
    },
    {
      shipping_rate_data: {
        type: "fixed_amount",
        display_name: "International shipping",
        tax_behavior: "exclusive",
        tax_code: SHIPPING_TAX_CODE,
        fixed_amount: { amount: 2500, currency: "usd" },
      },
    },
  ];
}
