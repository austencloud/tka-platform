import { describe, expect, it } from "vitest";
import { isViewerReadyToAutoplay } from "./viewer-autoplay-readiness";

describe("isViewerReadyToAutoplay", () => {
  it("never autoplays a cloud-backed scan with a partial card", () => {
    expect(
      isViewerReadyToAutoplay({
        cloudBackedScan: true,
        loadedCells: 4,
        totalCells: 13,
        elapsedMs: 30_000,
      })
    ).toBe(false);
  });

  it("autoplays a cloud-backed scan only when every card cell settled", () => {
    expect(
      isViewerReadyToAutoplay({
        cloudBackedScan: true,
        loadedCells: 13,
        totalCells: 13,
        elapsedMs: 80,
      })
    ).toBe(true);
  });

  it("keeps the existing four-cell or timeout behavior outside scans", () => {
    expect(
      isViewerReadyToAutoplay({
        cloudBackedScan: false,
        loadedCells: 4,
        totalCells: 13,
        elapsedMs: 80,
      })
    ).toBe(true);
    expect(
      isViewerReadyToAutoplay({
        cloudBackedScan: false,
        loadedCells: 0,
        totalCells: 13,
        elapsedMs: 500,
      })
    ).toBe(true);
  });
});
