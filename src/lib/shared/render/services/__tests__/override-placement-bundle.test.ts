import { describe, it, expect } from "vitest";
import { buildOverridePlacementBundle, type OverridePlacementBundle } from "../override-placement-bundle";

describe("buildOverridePlacementBundle", () => {
  it("returns empty arrays when no override singletons are initialized", () => {
    const b: OverridePlacementBundle = buildOverridePlacementBundle();
    expect(b.default).toEqual([]);
    expect(b.special).toEqual([]);
    expect(b.global).toEqual([]);
    expect(b.propGeometry).toEqual([]);
  });
});
