import { describe, it, expect } from "vitest";
import { DEFAULT_EFFECTS_CONFIG } from "$lib/shared/effects/domain/defaults";
import { EFFECTS_CONFIG_VERSION } from "$lib/shared/effects/domain/effects-config";

describe("DEFAULT_EFFECTS_CONFIG", () => {
  it("has the current schema version", () => {
    expect(DEFAULT_EFFECTS_CONFIG.version).toBe(EFFECTS_CONFIG_VERSION);
  });

  it("has a tipEffectMap with trails as the global default", () => {
    expect(DEFAULT_EFFECTS_CONFIG.tipEffectMap).toEqual({
      "*": { effect: "trails" },
    });
  });

  it("has valid trails intent", () => {
    const t = DEFAULT_EFFECTS_CONFIG.trails;
    expect(t.trackingMode).toBe("both_ends");
    expect(t.thickness).toBeGreaterThanOrEqual(1);
    expect(t.thickness).toBeLessThanOrEqual(12);
    expect(t.brightness).toBeGreaterThanOrEqual(0.3);
    expect(t.brightness).toBeLessThanOrEqual(1.0);
    expect(t.blueColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(t.redColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(t.rainbow).toBe(false);
  });

  it("has valid fire intent", () => {
    const f = DEFAULT_EFFECTS_CONFIG.fire;
    expect(f.intensity).toBeGreaterThanOrEqual(0.45);
    expect(f.intensity).toBeLessThanOrEqual(1.0);
    expect(f.colorBlend).toBeGreaterThanOrEqual(0);
    expect(f.colorBlend).toBeLessThanOrEqual(1);
    expect(f.turbulence).toBeGreaterThanOrEqual(0);
    expect(f.turbulence).toBeLessThanOrEqual(1);
    expect(f.colorCurve).toBeNull();
    expect(f.propColors).toBeNull();
    expect(f.customColors).toBeNull();
  });

  it("has valid led intent", () => {
    const l = DEFAULT_EFFECTS_CONFIG.led;
    expect(l.brightness).toBeGreaterThanOrEqual(1);
    expect(l.brightness).toBeLessThanOrEqual(5);
    expect(Number.isInteger(l.brightness)).toBe(true);
    expect(l.patternId).toBeTypeOf("string");
    expect(l.patternSpeed).toBeGreaterThanOrEqual(0.1);
    expect(l.patternSpeed).toBeLessThanOrEqual(5.0);
    expect(l.primaryColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(l.colorMode).toMatch(/^(unified|per-hand|prop-matched)$/);
  });

  it("has valid charcoal intent", () => {
    const c = DEFAULT_EFFECTS_CONFIG.charcoal;
    for (const k of ["intensity", "spread", "glow"] as const) {
      expect(c[k]).toBeGreaterThanOrEqual(0);
      expect(c[k]).toBeLessThanOrEqual(1);
    }
  });

  it("uses Sumi Flow as the ink default", () => {
    expect(DEFAULT_EFFECTS_CONFIG.ink).toEqual({
      ambientEmission: 0.1,
      motionEmission: 0.94,
      intensity: 0.68,
      palette: "sumi",
      customColor: "#0a0a0a",
      viscosity: 0.38,
      splatterIntensity: 0.16,
      trackingMode: "both_ends",
    });
  });

  it("has activePresets all null", () => {
    expect(DEFAULT_EFFECTS_CONFIG.activePresets).toEqual({
      trails: null,
      fire: null,
      led: null,
      charcoal: null,
      zap: null,
      sparkles: null,
      ghost: null,
      bloom: null,
      goo: null,
      bubbles: null,
      petals: null,
      smoke: null,
      ink: null,
      frost: null,
      silk: null,
      animal: null,
      pulse: null,
    });
  });

  it("has no overrides by default", () => {
    expect(DEFAULT_EFFECTS_CONFIG.overrides).toBeUndefined();
  });

  it("round-trips through JSON.stringify / JSON.parse", () => {
    const serialized = JSON.stringify(DEFAULT_EFFECTS_CONFIG);
    const parsed = JSON.parse(serialized);
    expect(parsed).toEqual(DEFAULT_EFFECTS_CONFIG);
  });
});
