import { describe, it, expect } from "vitest";
import { ringPlacements, type Placement } from "./placements";

describe("ringPlacements", () => {
  it("returns one placement per count", () => {
    const out = ringPlacements({ count: 12, radius: 10, radiusJitter: 1, scaleBase: 1, scaleVariation: 0.3, seed: 0 });
    expect(out).toHaveLength(12);
  });
  it("is deterministic for the same seed", () => {
    const cfg = { count: 8, radius: 9, radiusJitter: 1.5, scaleBase: 1, scaleVariation: 0.4, seed: 7 };
    expect(ringPlacements(cfg)).toEqual(ringPlacements(cfg));
  });
  it("keeps placements within radius +/- jitter", () => {
    const out = ringPlacements({ count: 20, radius: 10, radiusJitter: 2, scaleBase: 1, scaleVariation: 0, seed: 3 });
    for (const p of out) {
      const r = Math.hypot(p.x, p.z);
      expect(r).toBeGreaterThanOrEqual(8 - 1e-6);
      expect(r).toBeLessThanOrEqual(12 + 1e-6);
    }
  });
});
