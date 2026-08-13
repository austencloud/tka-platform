import { describe, it, expect } from "vitest";
import { migrateEffectsConfig } from "../../../src/lib/shared/effects/domain/migrations";
import { DEFAULT_EFFECTS_CONFIG } from "../../../src/lib/shared/effects/domain/defaults";

describe("migrateEffectsConfig", () => {
  it("returns v2 config untouched", () => {
    const v2 = structuredClone(DEFAULT_EFFECTS_CONFIG);
    const result = migrateEffectsConfig(v2);
    expect(result).toEqual(v2);
  });

  it("migrates v1 config through full chain to current version", () => {
    const v1: Record<string, unknown> = {
      version: 1,
      tipEffectMap: { "*": { effect: "trails" } },
      trails: DEFAULT_EFFECTS_CONFIG.trails,
      fire: DEFAULT_EFFECTS_CONFIG.fire,
      led: DEFAULT_EFFECTS_CONFIG.led,
      charcoal: DEFAULT_EFFECTS_CONFIG.charcoal,
      activePresets: { trails: null, fire: null, led: null, charcoal: null },
    };
    const result = migrateEffectsConfig(v1);
    expect(result.version).toBe(DEFAULT_EFFECTS_CONFIG.version);
    expect(result.zap).toEqual(DEFAULT_EFFECTS_CONFIG.zap);
    expect(result.sparkles).toEqual(DEFAULT_EFFECTS_CONFIG.sparkles);
    expect(result.ghost).toEqual(DEFAULT_EFFECTS_CONFIG.ghost);
    expect(result.bloom).toEqual(DEFAULT_EFFECTS_CONFIG.bloom);
    expect(result.activePresets.zap).toBeNull();
    expect(result.activePresets.sparkles).toBeNull();
    expect(result.activePresets.ghost).toBeNull();
    expect(result.activePresets.bloom).toBeNull();
  });

  it("preserves existing v1 values for trails/fire/led/charcoal", () => {
    const v1: Record<string, unknown> = {
      version: 1,
      tipEffectMap: { "*": { effect: "fire" } },
      trails: { ...DEFAULT_EFFECTS_CONFIG.trails, thickness: 10 },
      fire: { ...DEFAULT_EFFECTS_CONFIG.fire, intensity: 0.9 },
      led: DEFAULT_EFFECTS_CONFIG.led,
      charcoal: DEFAULT_EFFECTS_CONFIG.charcoal,
      activePresets: {
        trails: null,
        fire: "fire-intense",
        led: null,
        charcoal: null,
      },
    };
    const result = migrateEffectsConfig(v1);
    expect(result.trails.thickness).toBe(10);
    expect(result.fire.intensity).toBe(0.9);
    expect(result.activePresets.fire).toBe("fire-intense");
  });

  it("adds Bloom core strength and maps the retired Ring falloff to Smooth", () => {
    const legacy = structuredClone(DEFAULT_EFFECTS_CONFIG) as unknown as Record<
      string,
      unknown
    >;
    legacy.version = 33;
    const bloom = legacy.bloom as Record<string, unknown>;
    delete bloom.coreStrength;
    bloom.falloff = "ring";

    const result = migrateEffectsConfig(legacy);
    expect(result.bloom.coreStrength).toBe(
      DEFAULT_EFFECTS_CONFIG.bloom.coreStrength
    );
    expect(result.bloom.falloff).toBe("smooth");
  });

  it("preserves a deliberate Bloom core strength", () => {
    const current = structuredClone(DEFAULT_EFFECTS_CONFIG);
    current.bloom.coreStrength = 0.82;
    expect(migrateEffectsConfig(current).bloom.coreStrength).toBe(0.82);
  });
});
