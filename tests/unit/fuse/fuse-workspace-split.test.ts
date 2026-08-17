import { describe, expect, it } from "vitest";
import {
  getBestFuseStepColumns,
  resolveBalancedFuseWorkspaceSplit,
} from "$lib/features/fuse/services/fuse-workspace-split";

describe("Fuse desktop workspace split", () => {
  it("balances an eight-step source workbench against the 4K preview ideal", () => {
    const result = resolveBalancedFuseWorkspaceSplit({
      availableWidth: 3752,
      cardBoxHeight: 837,
      stepCount: 8,
      previewIdealWidth: 2018,
      minLeft: 1050,
      maxLeft: 2000,
      cardHorizontalChrome: 44,
    });

    expect(result.stepColumns).toBe(4);
    expect(result.splitPx).toBeGreaterThanOrEqual(1900);
    expect(result.splitPx).toBeLessThanOrEqual(1960);
    expect(3752 - result.splitPx).toBeGreaterThanOrEqual(1790);
  });

  it("gives a shorter four-step card less width than the animation stage", () => {
    const result = resolveBalancedFuseWorkspaceSplit({
      availableWidth: 2490,
      cardBoxHeight: 487,
      stepCount: 4,
      previewIdealWidth: 1298,
      minLeft: 760,
      maxLeft: 1400,
      cardHorizontalChrome: 44,
    });

    expect(result.stepColumns).toBe(2);
    expect(result.splitPx).toBeLessThan(2490 - result.splitPx);
  });

  it("chooses the most legible source arrangement inside a constrained width", () => {
    const result = resolveBalancedFuseWorkspaceSplit({
      availableWidth: 3752,
      cardBoxHeight: 837,
      stepCount: 16,
      previewIdealWidth: 2018,
      minLeft: 1050,
      maxLeft: 2000,
      cardHorizontalChrome: 44,
    });

    expect(result.stepColumns).toBe(6);
    expect(result.splitPx).toBeLessThanOrEqual(2000);
  });

  it("keeps manual seam grid selection aligned with the visible cell size", () => {
    expect(getBestFuseStepColumns(1930, 837, 8, 44)).toBe(4);
    expect(getBestFuseStepColumns(900, 487, 4, 44)).toBe(2);
  });
});
