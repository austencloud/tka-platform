import { resolveActivePriceId, isMisauthoredPastCutoff } from "./resolveActivePrice";

const CUTOFF = "2026-09-30T23:59:59-05:00";
const CUTOFF_MS = Date.parse(CUTOFF);
const BEFORE = CUTOFF_MS - 1;
const AFTER = CUTOFF_MS + 1;

const full = {
  stripePriceId: "price_preorder",
  regularStripePriceId: "price_regular",
  preorderPriceCutoff: CUTOFF,
};

describe("resolveActivePriceId", () => {
  it("charges preorder before the cutoff", () => {
    expect(resolveActivePriceId(full, BEFORE)).toBe("price_preorder");
  });

  it("charges regular at or after the cutoff instant", () => {
    expect(resolveActivePriceId(full, CUTOFF_MS)).toBe("price_regular");
    expect(resolveActivePriceId(full, AFTER)).toBe("price_regular");
  });

  it("evergreen (no cutoff) always charges preorder", () => {
    expect(resolveActivePriceId({ stripePriceId: "price_preorder" }, AFTER)).toBe(
      "price_preorder"
    );
  });

  it("fails safe to preorder when past cutoff but no regular price authored", () => {
    const noRegular = { stripePriceId: "price_preorder", preorderPriceCutoff: CUTOFF };
    expect(resolveActivePriceId(noRegular, AFTER)).toBe("price_preorder");
  });

  it("fails safe to preorder on an unparseable cutoff", () => {
    const badDate = { ...full, preorderPriceCutoff: "not-a-date" };
    expect(resolveActivePriceId(badDate, AFTER)).toBe("price_preorder");
  });
});

describe("isMisauthoredPastCutoff", () => {
  it("flags past-cutoff with no regular price", () => {
    const noRegular = { stripePriceId: "price_preorder", preorderPriceCutoff: CUTOFF };
    expect(isMisauthoredPastCutoff(noRegular, AFTER)).toBe(true);
  });

  it("does not flag a correctly-authored product", () => {
    expect(isMisauthoredPastCutoff(full, AFTER)).toBe(false);
  });

  it("does not flag before the cutoff", () => {
    const noRegular = { stripePriceId: "price_preorder", preorderPriceCutoff: CUTOFF };
    expect(isMisauthoredPastCutoff(noRegular, BEFORE)).toBe(false);
  });

  it("does not flag an evergreen product", () => {
    expect(isMisauthoredPastCutoff({ stripePriceId: "price_preorder" }, AFTER)).toBe(false);
  });
});
