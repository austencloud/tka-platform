import { describe, it, expect } from "vitest";
import { cyrb128, sfc32, makeRng, childSeed } from "../seeded-rng";

describe("seeded-rng", () => {
  it("makeRng is deterministic for the same seed", () => {
    const a = makeRng("deck-seed-001");
    const b = makeRng("deck-seed-001");
    const seqA = [a(), a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it("different seeds diverge", () => {
    const a = makeRng("seed-A");
    const b = makeRng("seed-B");
    expect(a()).not.toEqual(b());
  });

  it("yields floats in [0, 1)", () => {
    const r = makeRng("range-check");
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("childSeed is stable per key and distinct across keys", () => {
    expect(childSeed("master", 3)).toEqual(childSeed("master", 3));
    expect(childSeed("master", 3)).not.toEqual(childSeed("master", 4));
  });

  it("cyrb128 returns four uint32 values", () => {
    const h = cyrb128("hello");
    expect(h).toHaveLength(4);
    for (const n of h) expect(n).toBeGreaterThanOrEqual(0);
  });

  it("sfc32 is a stateful generator", () => {
    const r = sfc32(1, 2, 3, 4);
    expect(typeof r()).toBe("number");
  });
});
