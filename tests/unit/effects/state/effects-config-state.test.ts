import { describe, it, expect } from "vitest";
import { createEffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
import { DEFAULT_EFFECTS_CONFIG } from "$lib/shared/effects/domain/defaults";
import { BUILT_IN_TRAIL_PRESETS } from "$lib/shared/effects/domain/presets/built-in-trail-presets";
import { BUILT_IN_FIRE_PRESETS } from "$lib/shared/effects/domain/presets/built-in-fire-presets";

describe("createEffectsConfigState", () => {
  it("starts with default config when no initial supplied", () => {
    const s = createEffectsConfigState();
    expect(s.config.version).toBe(DEFAULT_EFFECTS_CONFIG.version);
    expect(s.config.trails.thickness).toBe(DEFAULT_EFFECTS_CONFIG.trails.thickness);
  });

  it("updateTrails merges partial patches", () => {
    const s = createEffectsConfigState();
    s.updateTrails({ thickness: 8 });
    expect(s.config.trails.thickness).toBe(8);
    expect(s.config.trails.brightness).toBe(DEFAULT_EFFECTS_CONFIG.trails.brightness);
  });

  it("updateTrails clears activePresets.trails (user dragged a slider)", () => {
    const s = createEffectsConfigState({
      ...DEFAULT_EFFECTS_CONFIG,
      activePresets: { ...DEFAULT_EFFECTS_CONFIG.activePresets, trails: "trail-neon" },
    });
    s.updateTrails({ thickness: 8 });
    expect(s.config.activePresets.trails).toBeNull();
  });

  it("updateFire merges and clears activePresets.fire", () => {
    const s = createEffectsConfigState({
      ...DEFAULT_EFFECTS_CONFIG,
      activePresets: { ...DEFAULT_EFFECTS_CONFIG.activePresets, fire: "fire-classic" },
    });
    s.updateFire({ intensity: 0.95 });
    expect(s.config.fire.intensity).toBe(0.95);
    expect(s.config.activePresets.fire).toBeNull();
  });

  it("applyPreset deep-merges preset patch and sets activePresets reference", () => {
    const s = createEffectsConfigState();
    const neonPreset = BUILT_IN_TRAIL_PRESETS.find((p) => p.id === "trail-neon")!;
    s.applyPreset(neonPreset);
    expect(s.config.trails.blueColor).toBe("#00ffcc");
    expect(s.config.trails.redColor).toBe("#ff00ff");
    expect(s.config.activePresets.trails).toBe("trail-neon");
  });

  it("applyPreset preserves fields not touched by patch", () => {
    const s = createEffectsConfigState();
    const originalFire = s.config.fire.intensity;
    const classicPreset = BUILT_IN_FIRE_PRESETS.find((p) => p.id === "fire-classic")!;
    s.applyPreset(classicPreset);
    expect(s.config.fire.intensity).toBe(originalFire);
    expect(s.config.fire.colorCurve).not.toBeNull();
  });

  it("setTipEffectMap replaces the map", () => {
    const s = createEffectsConfigState();
    s.setTipEffectMap({ "*": { effect: "fire" } });
    expect(s.config.tipEffectMap).toEqual({ "*": { effect: "fire" } });
  });

  it("replace swaps the entire config atomically", () => {
    const s = createEffectsConfigState();
    const next = {
      ...DEFAULT_EFFECTS_CONFIG,
      trails: { ...DEFAULT_EFFECTS_CONFIG.trails, thickness: 11 },
    };
    s.replace(next);
    expect(s.config.trails.thickness).toBe(11);
  });

  it("updateOverride creates the overrides object lazily", () => {
    const s = createEffectsConfigState();
    expect(s.config.overrides).toBeUndefined();
    s.updateOverride("fire3D", { volumetricDensity: 0.9 });
    expect(s.config.overrides?.fire3D).toEqual({ volumetricDensity: 0.9 });
  });

  it("updateOverride merges subsequent patches", () => {
    const s = createEffectsConfigState();
    s.updateOverride("fire3D", { volumetricDensity: 0.9 });
    s.updateOverride("fire3D", { shadowCasting: true });
    expect(s.config.overrides?.fire3D).toEqual({
      volumetricDensity: 0.9,
      shadowCasting: true,
    });
  });
});
