import { describe, it, expect } from "vitest";
import {
  resolveTrails2D,
  resolveFire2D,
  resolveLed2D,
  resolveCharcoal2D,
} from "$lib/shared/effects/translators/canvas2d-translator";
import { DEFAULT_EFFECTS_CONFIG } from "$lib/shared/effects/domain/defaults";

describe("resolveTrails2D", () => {
  const intent = DEFAULT_EFFECTS_CONFIG.trails;

  it("maps thickness directly to lineWidth", () => {
    expect(resolveTrails2D({ ...intent, thickness: 6 }).lineWidth).toBe(6);
  });

  it("maps brightness to maxOpacity 1:1", () => {
    expect(resolveTrails2D({ ...intent, brightness: 0.8 }).maxOpacity).toBe(0.8);
  });

  it("derives minOpacity as brightness * 0.3", () => {
    const out = resolveTrails2D({ ...intent, brightness: 1.0 });
    expect(out.minOpacity).toBeCloseTo(0.3, 5);
  });

  it("defaults glowBlur to 3 when no override", () => {
    expect(resolveTrails2D(intent).glowBlur).toBe(3);
  });

  it("override glowBlur wins", () => {
    expect(resolveTrails2D(intent, { glowBlur: 10 }).glowBlur).toBe(10);
  });

  it("preserves color fields from intent", () => {
    const out = resolveTrails2D({ ...intent, blueColor: "#abc123", redColor: "#def456" });
    expect(out.blueColor).toBe("#abc123");
    expect(out.redColor).toBe("#def456");
  });
});

describe("resolveFire2D", () => {
  const intent = DEFAULT_EFFECTS_CONFIG.fire;

  it("preserves intent fields", () => {
    const out = resolveFire2D({ ...intent, intensity: 0.85, turbulence: 0.3 });
    expect(out.intensity).toBe(0.85);
    expect(out.turbulence).toBe(0.3);
  });

  it("override flickerRate wins", () => {
    expect(resolveFire2D(intent, { flickerRate: 12 }).flickerRate).toBe(12);
  });
});

describe("resolveLed2D", () => {
  const intent = DEFAULT_EFFECTS_CONFIG.led;

  it("preserves intent fields", () => {
    const out = resolveLed2D({ ...intent, brightness: 3, primaryColor: "#abcdef" });
    expect(out.brightness).toBe(3);
    expect(out.primaryColor).toBe("#abcdef");
  });

  it("defaults dotRadius to 2", () => {
    expect(resolveLed2D(intent).dotRadius).toBe(2);
  });
});

describe("resolveCharcoal2D", () => {
  const intent = DEFAULT_EFFECTS_CONFIG.charcoal;

  it("preserves semantic fields", () => {
    const out = resolveCharcoal2D({ ...intent, intensity: 0.9 });
    expect(out.intensity).toBe(0.9);
  });

  it("defaults particleCount to 200", () => {
    expect(resolveCharcoal2D(intent).particleCount).toBe(200);
  });
});
