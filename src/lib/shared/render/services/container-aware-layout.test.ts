import { describe, it, expect } from "vitest";
import { pickBestFitLayout, type BestFitInput } from "./container-aware-layout";

/**
 * Auto layout picker: prefers the fullest grid over a bigger-but-gappy one.
 * See docs/superpowers/specs/2026-07-10-auto-layout-full-grid-design.md.
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

describe("pickBestFitLayout — full grid over bigger-but-gappy", () => {
  it("8 + start + QR: picks a full grid (only the QR slot may be empty), never the 4×3 gappy shape", () => {
    // Portrait-ish container where the gappy sc=3 4×3 shape used to win on size.
    const fit = pickBestFitLayout(input({ containerWidth: 500, containerHeight: 900 }));
    expect(fit).not.toBeNull();
    // At most one empty cell — the reserved QR slot. No visible corner gaps.
    expect(wasted(fit!, 8, true)).toBeLessThanOrEqual(1);
    // Explicitly reject the old 4×3 (12-cell, 3-wasted) choice.
    expect(fit!.cols * fit!.rows).not.toBe(12);
  });

  it("8 + start + QR: is one of the known full shapes (5×2 or 2×5)", () => {
    const fit = pickBestFitLayout(input({ containerWidth: 500, containerHeight: 900 }))!;
    const shape = `${fit.cols}x${fit.rows}`;
    expect(["5x2", "2x5"]).toContain(shape);
  });

  it("7 + start + QR (prime): returns the least-wasteful real shape, not a 1-wide strip", () => {
    const fit = pickBestFitLayout(input({ stepCount: 7 }))!;
    expect(fit).not.toBeNull();
    // Not a degenerate strip.
    expect(fit.cols).toBeGreaterThan(1);
    // 5×2 (one trailing empty) is the minimal-waste shape for 7+start+QR.
    expect(wasted(fit, 7, true)).toBeLessThanOrEqual(2);
  });

  it("8, no start, no QR: prefers a perfectly-tiling shape (0 wasted)", () => {
    const fit = pickBestFitLayout(
      input({ includeStartPosition: false, showQRCode: false, containerWidth: 800, containerHeight: 800 }),
    )!;
    expect(wasted(fit, 8, false)).toBe(0);
  });

  it("size still decides among equally-full shapes: wide container favors more columns", () => {
    // Both 5x2 and 2x5 are full for 8+start. A very wide, short container should
    // pick the wider (5x2) so the cell edge is larger.
    const fit = pickBestFitLayout(input({ containerWidth: 2000, containerHeight: 500 }))!;
    expect(fit.cols).toBeGreaterThan(fit.rows);
  });

  it("size still decides among equally-full shapes: tall container favors more rows", () => {
    const fit = pickBestFitLayout(input({ containerWidth: 400, containerHeight: 2000 }))!;
    expect(fit.rows).toBeGreaterThan(fit.cols);
  });

  it("degenerate inputs return null", () => {
    expect(pickBestFitLayout(input({ stepCount: 0 }))).toBeNull();
    expect(pickBestFitLayout(input({ containerWidth: 0 }))).toBeNull();
    expect(pickBestFitLayout(input({ containerHeight: -1 }))).toBeNull();
  });
});
