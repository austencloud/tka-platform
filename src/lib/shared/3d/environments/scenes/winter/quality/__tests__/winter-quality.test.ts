import { describe, expect, it } from "vitest";
import { getWinterQualityConfig } from "../winter-quality";

describe("winter quality budgets", () => {
  it("reduces ice-surface and snowfall cost without changing the material", () => {
    const high = getWinterQualityConfig("high");
    const medium = getWinterQualityConfig("medium");
    const low = getWinterQualityConfig("low");

    expect(high.pondSurfaceDetail).toBe("full");
    expect(medium.pondSurfaceDetail).toBe("reduced");
    expect(low.pondSurfaceDetail).toBe("reduced");
    expect(high.sceneryMultiplier).toBe(1);
    expect(high.sceneryMultiplier).toBeGreaterThan(medium.sceneryMultiplier);
    expect(medium.sceneryMultiplier).toBeGreaterThan(low.sceneryMultiplier);
    expect(high.snowMultiplier).toBeGreaterThan(medium.snowMultiplier);
    expect(medium.snowMultiplier).toBeGreaterThan(low.snowMultiplier);
  });
});
