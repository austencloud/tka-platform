import { describe, it, expect } from "vitest";
import { performerRing, depthRadiusFraction } from "./performer-ring-model";
import { DEFAULT_CONFIG, imageCount, type TunnelConfig } from "./tunnel-config";

const cfg = (over: Partial<TunnelConfig>): TunnelConfig => ({ ...DEFAULT_CONFIG, ...over });

describe("performerRing — count matches imageCount", () => {
  const cases: TunnelConfig[] = [
    cfg({ fold: 1 }),
    cfg({ fold: 2 }),
    cfg({ fold: 2, mirror: true }),
    cfg({ fold: 4, mirror: true, flip: true }),
    cfg({ fold: 8 }),
    cfg({ fold: 8, mirror: true }),
  ];
  for (const c of cases) {
    it(`emits imageCount(${JSON.stringify({ fold: c.fold, mirror: c.mirror, flip: c.flip })}) performers`, () => {
      expect(performerRing(c).length).toBe(imageCount(c));
    });
  }

  it("stable ids are unique (so keyed transitions don't collide)", () => {
    const ids = performerRing(cfg({ fold: 4, mirror: true, flip: true })).map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("the base performer is present and at depth 0 (the 'you' seed)", () => {
    const ring = performerRing(cfg({ fold: 4, mirror: true }));
    const seed = ring.find((p) => p.id === "f0");
    expect(seed).toBeDefined();
    expect(seed!.depth).toBe(0);
  });
});

describe("performerRing — motion modulators never change the cast", () => {
  const base = cfg({ fold: 4, mirror: true });
  it("invert/echo/stagger/speed leave the ring identical (motion is free)", () => {
    const ref = performerRing(base);
    for (const over of [
      { invert: true },
      { echo: true },
      { speed: true },
      { staggerSteps: 3 },
    ] as Partial<TunnelConfig>[]) {
      expect(performerRing({ ...base, ...over })).toEqual(ref);
    }
  });
});

describe("depthRadiusFraction — reflected twins seat on tighter rings", () => {
  it("strictly decreases with depth so coincident twins stay countable", () => {
    expect(depthRadiusFraction(0)).toBeGreaterThan(depthRadiusFraction(1));
    expect(depthRadiusFraction(1)).toBeGreaterThan(depthRadiusFraction(2));
  });
  it("clamps depth beyond 2 to the innermost ring", () => {
    expect(depthRadiusFraction(5)).toBe(depthRadiusFraction(2));
  });
});
