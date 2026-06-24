import { describe, it, expect } from "vitest";
import {
  BUILT_IN_COLOR_PRESETS,
  findPreset,
  validatePreset,
  type LedColorPreset,
} from "$lib/shared/animation-engine/domain/types/led-color-presets";

describe("Color Presets", () => {
  it("has 8 built-in presets", () => {
    expect(BUILT_IN_COLOR_PRESETS).toHaveLength(8);
  });

  it("all built-in presets have builtIn: true", () => {
    for (const p of BUILT_IN_COLOR_PRESETS) {
      expect(p.builtIn).toBe(true);
    }
  });

  it("all preset IDs are unique", () => {
    const ids = BUILT_IN_COLOR_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("findPreset locates by ID across built-in and user presets", () => {
    const userPresets: LedColorPreset[] = [
      { id: "custom-1", name: "My Color", primaryColor: "#ff0000", builtIn: false },
    ];
    expect(findPreset("green-glow", userPresets)).toBeDefined();
    expect(findPreset("custom-1", userPresets)).toBeDefined();
    expect(findPreset("nonexistent", userPresets)).toBeUndefined();
  });

  it("validatePreset rejects malformed presets", () => {
    expect(validatePreset({ id: "x", name: "X", primaryColor: "#fff000", builtIn: false })).toBe(true);
    expect(validatePreset({ id: "", name: "X", primaryColor: "#fff000", builtIn: false })).toBe(false);
    expect(validatePreset({ name: "X", primaryColor: "#fff000", builtIn: false } as any)).toBe(false);
    expect(validatePreset(null as any)).toBe(false);
  });
});
