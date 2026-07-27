import {
  buildMerchShippingOptions,
  isUsShippingIncludedProductType,
} from "./shippingOptions";

describe("buildMerchShippingOptions", () => {
  it("includes US shipping in deck and sampler prices", () => {
    const options = buildMerchShippingOptions({ freeUsShipping: true });
    const us = options.find(
      (option) => option.shipping_rate_data?.display_name === "Free US shipping"
    );

    expect(us?.shipping_rate_data?.fixed_amount?.amount).toBe(0);
  });

  it("charges US shipping when no shipping-inclusive product is present", () => {
    const options = buildMerchShippingOptions({ freeUsShipping: false });
    const us = options.find(
      (option) => option.shipping_rate_data?.display_name === "US shipping"
    );

    expect(us?.shipping_rate_data?.fixed_amount?.amount).toBe(500);
  });

  it("classifies deck products without treating every physical item as shipping-inclusive", () => {
    expect(isUsShippingIncludedProductType("physical-deck")).toBe(true);
    expect(isUsShippingIncludedProductType("sampler-pack")).toBe(true);
    expect(isUsShippingIncludedProductType("guide")).toBe(false);
    expect(isUsShippingIncludedProductType("poster")).toBe(false);
  });

  it("gives every rate Stripe's shipping tax code and exclusive tax behavior", () => {
    for (const option of buildMerchShippingOptions({ freeUsShipping: true })) {
      expect(option.shipping_rate_data?.tax_behavior).toBe("exclusive");
      expect(option.shipping_rate_data?.tax_code).toBe("txcd_92010001");
    }
  });
});
