import { describe, it, expect } from "vitest";
import {
  resolveTrails3D,
  resolveFire3D,
  resolveLed3D,
  resolveCharcoal3D,
} from "$lib/shared/effects/translators/webgl3d-translator";
import { DEFAULT_EFFECTS_CONFIG } from "$lib/shared/effects/domain/defaults";

describe("resolveTrails3D", () => {
  const intent = DEFAULT_EFFECTS_CONFIG.trails;

  it("derives tubeRadius from thickness", () => {
    const out = resolveTrails3D({ ...intent, thickness: 6 });
    expect(out.tubeRadius).toBeCloseTo(0.048, 5); // 6 * 0.008
  });

  it("derives emissive from brightness", () => {
    const out = resolveTrails3D({ ...intent, brightness: 1.0 });
    expect(out.emissive).toBeCloseTo(2.0, 5);
  });

  it("derives bloomWeight from brightness", () => {
    const out = resolveTrails3D({ ...intent, brightness: 0.75 });
    expect(out.bloomWeight).toBeCloseTo(0.3, 5);
  });

  it("defaults taperCurve to exponential", () => {
    expect(resolveTrails3D(intent).taperCurve).toBe("exponential");
  });

  it("override taperCurve wins", () => {
    expect(resolveTrails3D(intent, { taperCurve: "linear" }).taperCurve).toBe("linear");
  });

  it("defaults maxPoints to 256", () => {
    expect(resolveTrails3D(intent).maxPoints).toBe(256);
  });
});

describe("resolveFire3D", () => {
  const intent = DEFAULT_EFFECTS_CONFIG.fire;

  it("volumetricDensity scales with intensity: 0.3 + i*0.7", () => {
    expect(resolveFire3D({ ...intent, intensity: 0.5 }).volumetricDensity).toBeCloseTo(0.65, 5);
    expect(resolveFire3D({ ...intent, intensity: 1.0 }).volumetricDensity).toBeCloseTo(1.0, 5);
  });

  it("emissionRate scales with intensity: 200 + i*800", () => {
    expect(resolveFire3D({ ...intent, intensity: 0.5 }).emissionRate).toBe(600);
    expect(resolveFire3D({ ...intent, intensity: 1.0 }).emissionRate).toBe(1000);
  });

  it("vortexStrength scales with turbulence: t*3", () => {
    expect(resolveFire3D({ ...intent, turbulence: 0.5 }).vortexStrength).toBeCloseTo(1.5, 5);
  });

  it("bloomContribution scales with intensity: i*0.6", () => {
    expect(resolveFire3D({ ...intent, intensity: 1.0 }).bloomContribution).toBeCloseTo(0.6, 5);
  });

  it("shadowCasting defaults to false", () => {
    expect(resolveFire3D(intent).shadowCasting).toBe(false);
  });

  it("override volumetricDensity wins", () => {
    expect(resolveFire3D(intent, { volumetricDensity: 0.9 }).volumetricDensity).toBe(0.9);
  });
});

describe("resolveLed3D", () => {
  const intent = DEFAULT_EFFECTS_CONFIG.led;

  it("defaults segmentCount to 200 (full strip)", () => {
    expect(resolveLed3D(intent).segmentCount).toBe(200);
  });

  it("defaults povPersistenceDuration to 0.12", () => {
    expect(resolveLed3D(intent).povPersistenceDuration).toBeCloseTo(0.12, 5);
  });

  it("preserves primaryColor from intent", () => {
    expect(resolveLed3D({ ...intent, primaryColor: "#123456" }).primaryColor).toBe("#123456");
  });
});

describe("resolveCharcoal3D", () => {
  const intent = DEFAULT_EFFECTS_CONFIG.charcoal;

  it("particleLifetime scales with glow: 0.5 + g*1.5", () => {
    expect(resolveCharcoal3D({ ...intent, glow: 0 }).particleLifetime).toBeCloseTo(0.5, 5);
    expect(resolveCharcoal3D({ ...intent, glow: 1 }).particleLifetime).toBeCloseTo(2.0, 5);
  });

  it("defaults gravity to -2.0 (upward drift)", () => {
    expect(resolveCharcoal3D(intent).gravity).toBeCloseTo(-2.0, 5);
  });
});
