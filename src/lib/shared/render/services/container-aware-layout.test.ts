import { describe, it, expect } from "vitest";
import { pickBestFitLayout, type BestFitInput } from "./container-aware-layout";

/**
 * Auto layout picker: gap-penalized size. Prefers full grids over
 * marginally-bigger gappy ones, but keeps a much-bigger grid over a skinny
 * full one. See docs/superpowers/specs/2026-07-10-auto-layout-full-grid-design.md.
 */

function input(overrides: Partial<BestFitInput>): BestFitInput {
  return {
    stepCount: 8,
    includeStartPosition: true,
    containerWidth: 600,
    containerHeight: 800,
    showHeader: true,
    showFooter: true,
    showQRCode: true,
    ...overrides,
  };
}

/** Empty cells in the returned grid. usedCells = steps + (start ? 1 : 0). */
function wasted(fit: { cols: number; rows: number }, stepCount: number, hasStart: boolean): number {
  return fit.cols * fit.rows - (stepCount + (hasStart ? 1 : 0));
}

describe("pickBestFitLayout — gap-penalized size", () => {
  it("8 + start + QR (squarish): picks the full 5×2, never the 3-gap 4×3", () => {
    // Container ~1.05 aspect where the gappy 4×3 renders biggest but wastes 3.
    const fit = pickBestFitLayout(input({ containerWidth: 895, containerHeight: 850 }))!;
    expect(fit).not.toBeNull();
    expect(`${fit.cols}x${fit.rows}`).toBe("5x2");
    expect(wasted(fit, 8, true)).toBe(1); // only the reserved QR slot
  });

  it("12 + start + QR (tall-ish): keeps the container-filling 4×4, not the skinny full 2×7", () => {
    // The regression case: pure fewest-waste picked 2×7 (skinny, small cells).
    const fit = pickBestFitLayout(input({ stepCount: 12, containerWidth: 900, containerHeight: 945 }))!;
    expect(fit).not.toBeNull();
    // 3 step columns + start column = 4 wide. NOT the 2-wide skinny grid.
    expect(fit.cols).toBeGreaterThanOrEqual(3);
    expect(fit.cols).not.toBe(2);
    expect(`${fit.cols}x${fit.rows}`).toBe("4x4");
  });

  it("12 + start + QR: the skinny 2-wide grid is rejected even though it wastes fewer cells", () => {
    const fit = pickBestFitLayout(input({ stepCount: 12, containerWidth: 900, containerHeight: 945 }))!;
    // 2×7 wastes only 1 but renders tiny; the penalty must not let it win.
    expect(fit.cols).not.toBe(2);
  });

  it("7 + start + QR (prime): returns a real shape, never a 1-wide strip", () => {
    const fit = pickBestFitLayout(input({ stepCount: 7 }))!;
    expect(fit).not.toBeNull();
    expect(fit.cols).toBeGreaterThan(1);
    expect(wasted(fit, 7, true)).toBeLessThanOrEqual(2);
  });

  it("8, no start, no QR (square): prefers the near-square 3×3", () => {
    const fit = pickBestFitLayout(
      input({ includeStartPosition: false, showQRCode: false, containerWidth: 800, containerHeight: 800 }),
    )!;
    // 3×3 (1 gap) fills a square container better than the full 4×2 / 2×4.
    expect(`${fit.cols}x${fit.rows}`).toBe("3x3");
  });

  it("size still decides among comparably-full shapes: wide container favors more columns", () => {
    const fit = pickBestFitLayout(input({ containerWidth: 2000, containerHeight: 500 }))!;
    expect(fit.cols).toBeGreaterThan(fit.rows);
  });

  it("size still decides among comparably-full shapes: tall container favors more rows", () => {
    const fit = pickBestFitLayout(input({ containerWidth: 400, containerHeight: 2000 }))!;
    expect(fit.rows).toBeGreaterThan(fit.cols);
  });

  it("degenerate inputs return null", () => {
    expect(pickBestFitLayout(input({ stepCount: 0 }))).toBeNull();
    expect(pickBestFitLayout(input({ containerWidth: 0 }))).toBeNull();
    expect(pickBestFitLayout(input({ containerHeight: -1 }))).toBeNull();
  });
});
