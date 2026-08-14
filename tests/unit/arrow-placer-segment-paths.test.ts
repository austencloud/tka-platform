import { describe, expect, it } from "vitest";
import { ArrowPlacer } from "../../src/lib/shared/pictograph/arrow/positioning/placement/services/arrow-placer";
import { GridMode } from "../../src/lib/shared/pictograph/grid/domain/enums/grid-enums";

function trackingCache() {
  const requested: string[] = [];
  let loads = 0;
  return {
    requested,
    getLoads: () => loads,
    cache: {
      get: async (path: string) => {
        requested.push(path);
        loads++;
        return {};
      },
    },
  };
}

describe("ArrowPlacer segment placement paths", () => {
  it("box and diamond share the grid-neutral canonical bucket", async () => {
    const t = trackingCache();
    const placer = new ArrowPlacer(t.cache as never);
    await placer.ensureLoaded(GridMode.BOX, "staff");
    const halfPaths = t.requested.filter((p) => p.includes("_half_"));
    expect(halfPaths).toHaveLength(4);
    for (const p of halfPaths) {
      expect(p).toMatch(
        /\/arrow_placement\/default\/default_(pro|anti|dash|static)_half_placements\.json$/
      );
    }
    expect(
      t.requested.some((p) => p.includes("default_pro_placements.json"))
    ).toBe(true);
    expect(t.requested.some((p) => p.includes("/diamond/"))).toBe(false);
    expect(t.requested.some((p) => p.includes("/box/"))).toBe(false);
  });

  it("concurrent ensureLoaded calls share one load per bucket", async () => {
    const t = trackingCache();
    const placer = new ArrowPlacer(t.cache as never);
    await Promise.all(
      Array.from({ length: 26 }, () =>
        placer.ensureLoaded(GridMode.BOX, "staff")
      )
    );
    // 5 motion files + 4 segment files = 9 fetches for ONE canonical bucket, not 26×9
    expect(t.getLoads()).toBe(9);
  });

  it("returns the canonical value when a caller requests box", async () => {
    const placer = new ArrowPlacer({
      get: async (path: string) =>
        path.endsWith("default_pro_placements.json")
          ? { pro_to_layer1_alpha: { "1": [37, -19] } }
          : {},
    } as never);

    await expect(
      placer.getDefaultAdjustment("pro", "pro_to_layer1_alpha", 1, GridMode.BOX)
    ).resolves.toEqual({ x: 37, y: -19 });
  });

  it("preloads one canonical bucket for skewed without changing its downstream tuple path", async () => {
    const t = trackingCache();
    const placer = new ArrowPlacer(t.cache as never);

    await placer.ensureLoaded(GridMode.SKEWED, "staff");

    expect(t.getLoads()).toBe(9);
    expect(
      t.requested.every((path) => path.includes("/arrow_placement/default/"))
    ).toBe(true);
    expect(t.requested.some((path) => path.includes("/diamond/"))).toBe(false);
    expect(t.requested.some((path) => path.includes("/box/"))).toBe(false);
    expect(placer.isLoaded(GridMode.SKEWED)).toBe(true);
  });
});
