import { describe, it, expect } from "vitest";
import { applyEasing } from "$lib/features/stage/state/formation-interpolator";

// The old keyframe-lerp `interpolateFormation` was retired when the module was
// rewritten into mark distance/speed utilities (commit 408a29a8b5). `applyEasing`
// is the surviving export; its tests are kept here.
describe("formation-interpolator: applyEasing", () => {
  it("applies easeInOut easing", () => {
    expect(applyEasing(0, "easeInOut")).toBe(0);
    expect(applyEasing(1, "easeInOut")).toBe(1);
    expect(applyEasing(0.5, "easeInOut")).toBeCloseTo(0.5);
    expect(applyEasing(0.25, "easeInOut")).toBeLessThan(0.25);
  });

  it("is identity under linear easing", () => {
    expect(applyEasing(0, "linear")).toBe(0);
    expect(applyEasing(0.37, "linear")).toBeCloseTo(0.37);
    expect(applyEasing(1, "linear")).toBe(1);
  });
});
