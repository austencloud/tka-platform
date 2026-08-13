import { describe, expect, it } from "vitest";
import {
  computeFluidJacobiIterations,
  computeFluidStepDissipation,
  shouldUseFluidMacCormack,
} from "./web-gl-fluid-solver-2d";

describe("fluid quality budget", () => {
  it("reduces pressure work as simultaneous fluid canvases increase", () => {
    expect(computeFluidJacobiIterations(1)).toBe(12);
    expect(computeFluidJacobiIterations(4)).toBe(8);
    expect(computeFluidJacobiIterations(6)).toBe(6);
  });

  it("keeps corrected scalar transport inside the four-instance budget", () => {
    expect(shouldUseFluidMacCormack(4)).toBe(true);
    expect(shouldUseFluidMacCormack(5)).toBe(false);
  });

  it("normalizes dissipation to elapsed time", () => {
    expect(computeFluidStepDissipation(0.98, 1 / 60)).toBeCloseTo(0.98);
    expect(computeFluidStepDissipation(0.98, 2 / 60)).toBeCloseTo(0.98 ** 2);
  });
});
