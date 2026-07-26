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
  it("box staff bucket requests DIAMOND _half files (segment nudges are grid-mode-invariant)", async () => {
    const t = trackingCache();
    const placer = new ArrowPlacer(t.cache as never);
    await placer.ensureLoaded(GridMode.BOX, "staff");
    const halfPaths = t.requested.filter((p) => p.includes("_half_"));
    expect(halfPaths).toHaveLength(4);
    for (const p of halfPaths) {
      expect(p).toMatch(
        /\/diamond\/default\/default_diamond_(pro|anti|dash|static)_half_placements\.json$/
      );
    }
    // full-motion files still box-keyed
    expect(t.requested.some((p) => p.includes("default_box_pro_placements.json"))).toBe(true);
  });

  it("concurrent ensureLoaded calls share one load per bucket", async () => {
    const t = trackingCache();
    const placer = new ArrowPlacer(t.cache as never);
    await Promise.all(Array.from({ length: 26 }, () => placer.ensureLoaded(GridMode.BOX, "staff")));
    // 5 motion files + 4 segment files = 9 fetches for ONE bucket, not 26×9
    expect(t.getLoads()).toBe(9);
  });
});
