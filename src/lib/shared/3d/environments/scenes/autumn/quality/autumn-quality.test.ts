import { describe, it, expect } from "vitest";
import { getAutumnQualityConfig } from "./autumn-quality";

describe("getAutumnQualityConfig", () => {
  it("scales detail down with tier", () => {
    const high = getAutumnQualityConfig("high");
    const low = getAutumnQualityConfig("low");
    expect(low.fillTreeCount).toBeLessThan(high.fillTreeCount);
    expect(low.leafCount).toBeLessThan(high.leafCount);
  });

  it("spends the shadow pass only where the GPU can afford it", () => {
    expect(getAutumnQualityConfig("high").shadows).toBe(true);
    expect(getAutumnQualityConfig("medium").shadows).toBe(true);
    expect(getAutumnQualityConfig("low").shadows).toBe(false);
    // The high tier buys back texel density lost to the wider shadow camera.
    expect(getAutumnQualityConfig("high").shadowMapSize).toBeGreaterThan(
      getAutumnQualityConfig("medium").shadowMapSize
    );
  });
});
