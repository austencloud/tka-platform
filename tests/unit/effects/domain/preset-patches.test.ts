import { describe, it, expect } from "vitest";
import { BUILT_IN_TRAIL_PRESETS } from "$lib/shared/effects/domain/presets/built-in-trail-presets";
import { BUILT_IN_FIRE_PRESETS } from "$lib/shared/effects/domain/presets/built-in-fire-presets";
import { BUILT_IN_LED_PRESETS } from "$lib/shared/effects/domain/presets/built-in-led-presets";
import { BUILT_IN_CHARCOAL_PRESETS } from "$lib/shared/effects/domain/presets/built-in-charcoal-presets";

describe("BUILT_IN_TRAIL_PRESETS", () => {
  it("contains default, neon, ember presets", () => {
    const ids = BUILT_IN_TRAIL_PRESETS.map((p) => p.id);
    expect(ids).toContain("trail-default");
    expect(ids).toContain("trail-neon");
    expect(ids).toContain("trail-ember");
  });

  it("every preset has name, description, effectType trails, builtIn true", () => {
    for (const p of BUILT_IN_TRAIL_PRESETS) {
      expect(p.name).toBeTypeOf("string");
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.description).toBeTypeOf("string");
      expect(p.effectType).toBe("trails");
      expect(p.builtIn).toBe(true);
    }
  });

  it("every preset patch only touches the trails field and activePresets", () => {
    for (const p of BUILT_IN_TRAIL_PRESETS) {
      const keys = Object.keys(p.patch);
      for (const k of keys) {
        expect(["trails", "activePresets"]).toContain(k);
      }
    }
  });

  it("trail-neon sets rainbow false and neon hex colors", () => {
    const neon = BUILT_IN_TRAIL_PRESETS.find((p) => p.id === "trail-neon")!;
    expect(neon.patch.trails?.blueColor).toBe("#00ffcc");
    expect(neon.patch.trails?.redColor).toBe("#ff00ff");
    expect(neon.patch.trails?.rainbow).toBe(false);
  });
});

describe("BUILT_IN_FIRE_PRESETS", () => {
  it("contains classic, blue-flame, spirit presets", () => {
    const ids = BUILT_IN_FIRE_PRESETS.map((p) => p.id);
    expect(ids).toContain("fire-classic");
    expect(ids).toContain("fire-blue-flame");
    expect(ids).toContain("fire-spirit");
  });

  it("every preset has effectType fire and builtIn true", () => {
    for (const p of BUILT_IN_FIRE_PRESETS) {
      expect(p.effectType).toBe("fire");
      expect(p.builtIn).toBe(true);
      expect(p.name).toBeTypeOf("string");
      expect(p.description).toBeTypeOf("string");
    }
  });

  it("fire-classic sets a 4-stop color curve", () => {
    const classic = BUILT_IN_FIRE_PRESETS.find((p) => p.id === "fire-classic")!;
    const curve = classic.patch.fire?.colorCurve;
    expect(curve).toBeDefined();
    expect(curve?.coldColor).toHaveLength(3);
    expect(curve?.midColor).toHaveLength(3);
    expect(curve?.hotColor).toHaveLength(3);
    expect(curve?.coreColor).toHaveLength(3);
  });

  it("fire presets do NOT touch intensity or turbulence (color-only)", () => {
    for (const p of BUILT_IN_FIRE_PRESETS) {
      expect(p.patch.fire?.intensity).toBeUndefined();
      expect(p.patch.fire?.turbulence).toBeUndefined();
    }
  });
});

describe("BUILT_IN_LED_PRESETS", () => {
  it("contains at least 4 built-in presets", () => {
    expect(BUILT_IN_LED_PRESETS.length).toBeGreaterThanOrEqual(4);
  });

  it("every preset has effectType led and a primaryColor", () => {
    for (const p of BUILT_IN_LED_PRESETS) {
      expect(p.effectType).toBe("led");
      expect(p.builtIn).toBe(true);
      expect(p.patch.led?.primaryColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it("led-rainbow sets patternId rainbow", () => {
    const rainbow = BUILT_IN_LED_PRESETS.find((p) => p.id === "led-rainbow");
    expect(rainbow?.patch.led?.patternId).toBe("rainbow");
  });

  it("led-prop-colors uses prop-matched color mode", () => {
    const propMatch = BUILT_IN_LED_PRESETS.find((p) => p.id === "led-prop-colors");
    expect(propMatch?.patch.led?.colorMode).toBe("prop-matched");
  });
});

describe("BUILT_IN_CHARCOAL_PRESETS", () => {
  it("contains at least 4 presets", () => {
    expect(BUILT_IN_CHARCOAL_PRESETS.length).toBeGreaterThanOrEqual(4);
  });

  it("every preset has effectType charcoal and semantic fields in 0-1", () => {
    for (const p of BUILT_IN_CHARCOAL_PRESETS) {
      expect(p.effectType).toBe("charcoal");
      expect(p.builtIn).toBe(true);
      const c = p.patch.charcoal!;
      for (const k of ["intensity", "spread", "glow"] as const) {
        expect(c[k]).toBeGreaterThanOrEqual(0);
        expect(c[k]).toBeLessThanOrEqual(1);
      }
    }
  });
});
