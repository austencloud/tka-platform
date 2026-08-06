import { describe, it, expect } from "vitest";
import { getAutumnQualityConfig } from "./autumn-quality";

describe("getAutumnQualityConfig", () => {
  it("scales detail down with tier", () => {
    const high = getAutumnQualityConfig("high");
    const low = getAutumnQualityConfig("low");
    expect(low.fillTreeCount).toBeLessThan(high.fillTreeCount);
    expect(low.leafCount).toBeLessThan(high.leafCount);
    expect(low.pondReflector).toBe(false);
    expect(high.pondReflector).toBe(false);
  });
});
