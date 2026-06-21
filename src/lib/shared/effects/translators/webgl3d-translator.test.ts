import { describe, it, expect } from "vitest";
import { resolveFire3D } from "./webgl3d-translator";
import type { FireIntent } from "../domain/effects-config";

const base: FireIntent = {
  intensity: 0.7,
  brightness: 1.0,
  colorBlend: 0.5,
  turbulence: 0.5,
  colorCurve: null,
  propColors: null,
  customColors: null,
};

describe("resolveFire3D", () => {
  it("maps brightness to emissiveHot monotonically", () => {
    expect(resolveFire3D({ ...base, brightness: 0 }).emissiveHot).toBeLessThan(
      resolveFire3D({ ...base, brightness: 1 }).emissiveHot,
    );
  });

  it("low brightness tames the core below the bloom-blowout zone (<= 1.6)", () => {
    expect(resolveFire3D({ ...base, brightness: 0.4 }).emissiveHot).toBeLessThanOrEqual(1.6);
  });

  it("intensity still drives emission rate", () => {
    expect(resolveFire3D({ ...base, intensity: 1 }).emissionRate).toBeGreaterThan(
      resolveFire3D({ ...base, intensity: 0 }).emissionRate,
    );
  });

  it("turbulence still drives vortex strength", () => {
    expect(resolveFire3D({ ...base, turbulence: 1 }).vortexStrength).toBeGreaterThan(
      resolveFire3D({ ...base, turbulence: 0 }).vortexStrength,
    );
  });

  it("override wins over the derived emissiveHot", () => {
    expect(resolveFire3D(base, { emissiveHot: 0.1 }).emissiveHot).toBe(0.1);
  });
});
