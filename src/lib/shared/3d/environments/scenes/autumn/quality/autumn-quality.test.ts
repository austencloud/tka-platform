import { describe, it, expect } from "vitest";
import { getAutumnQualityConfig } from "./autumn-quality";

describe("getAutumnQualityConfig", () => {
  it("scales detail down with tier", () => {
    const high = getAutumnQualityConfig("high");
    const low = getAutumnQualityConfig("low");
    expect(low.leafCount).toBeLessThan(high.leafCount);
    expect(low.fireflyCount).toBeLessThan(high.fireflyCount);
    expect(low.wispCount).toBeLessThan(high.wispCount);
  });

  it("keeps enough fireflies visible while most of the field is between flashes", () => {
    for (const tier of ["low", "medium", "high"] as const) {
      // The shared firefly pulse is intentionally dark for roughly 70% of a
      // cycle. A smaller budget made the whole habitat disappear by chance.
      expect(getAutumnQualityConfig(tier).fireflyCount).toBeGreaterThanOrEqual(
        36
      );
    }
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
