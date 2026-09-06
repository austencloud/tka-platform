import { describe, it, expect } from "vitest";
import { summarizeStudioSurfaceMotion } from "../../../src/routes/test/sequence-viewer-transitions/studio-surface-motion";

const sample = (selectedMode: string, left: number, width = 100) => ({
  selectedMode,
  workspace: { sharedSurfaces: { rail: { left, top: 0, width, height: 100 } } },
});

describe("Studio surface trajectory", () => {
  it("catches a size jump before an otherwise monotonic flight", () => {
    expect(
      summarizeStudioSurfaceMotion([
        sample("animation", 0, 740),
        sample("post-studio", 0, 801),
        sample("post-studio", 100, 300),
      ]).rail.sizeBacktrackPx
    ).toBe(61);
  });
  it("does not mistake a smooth round trip for backtracking", () => {
    expect(
      summarizeStudioSurfaceMotion([
        sample("animation", 0),
        sample("post-studio", 20),
        sample("post-studio", 100),
        sample("animation", 80),
        sample("animation", 0),
      ]).rail.backtrackPx
    ).toBe(0);
  });
  it("detects the side-to-side correction hidden by matching endpoints", () => {
    expect(
      summarizeStudioSurfaceMotion([
        sample("animation", 100),
        sample("post-studio", 130),
        sample("post-studio", 80),
        sample("post-studio", 100),
      ]).rail.backtrackPx
    ).toBe(50);
  });
  it("does not fabricate a trajectory for a collapsed or unmeasured surface", () => {
    expect(
      summarizeStudioSurfaceMotion([
        sample("animation", 0, 0),
        sample("post-studio", 100),
      ])
    ).toEqual({});
  });
});
