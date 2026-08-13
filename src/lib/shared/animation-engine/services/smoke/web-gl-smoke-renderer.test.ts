import { describe, expect, it } from "vitest";
import {
  computeSmokeDensityDissipation,
  computeSmokeSimulationResolution,
  hexToLinearRgb,
} from "./web-gl-smoke-renderer";

describe("fluid smoke quality", () => {
  it("maps existing pool tiers to bounded simulation grids", () => {
    expect(computeSmokeSimulationResolution(512)).toBe(96);
    expect(computeSmokeSimulationResolution(1024)).toBe(160);
    expect(computeSmokeSimulationResolution(2048)).toBe(224);
  });

  it("lets long-lived palettes retain density longer", () => {
    expect(computeSmokeDensityDissipation(6)).toBeGreaterThan(
      computeSmokeDensityDissipation(2)
    );
  });

  it("converts palette colors into linear-light shader values", () => {
    expect(hexToLinearRgb("#fff")).toEqual([1, 1, 1]);
    expect(hexToLinearRgb("#000")).toEqual([0, 0, 0]);
    expect(hexToLinearRgb("#808080")[0]).toBeCloseTo(0.216, 2);
  });
});
