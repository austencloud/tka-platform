import { describe, it, expect } from "vitest";
import { BUILT_IN_TRAIL_PRESETS } from "$lib/shared/effects/domain/presets/built-in-trail-presets";

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
