import { describe, it, expect } from "vitest";
import { DEFAULT_EFFECTS_CONFIG } from "../defaults";
import type { EffectsConfig } from "../effects-config";

describe("EffectsConfig schema", () => {
  it("has activeEffect field defaulting to 'none'", () => {
    expect(DEFAULT_EFFECTS_CONFIG.activeEffect).toBe("none");
  });

  it("has effectLayerOverrides field defaulting to empty object", () => {
    expect(DEFAULT_EFFECTS_CONFIG.effectLayerOverrides).toEqual({});
  });

  it("satisfies EffectsConfig type with new fields", () => {
    const config: EffectsConfig = {
      ...DEFAULT_EFFECTS_CONFIG,
      activeEffect: "fire",
      effectLayerOverrides: { fire: "front" },
    };
    expect(config.activeEffect).toBe("fire");
    expect(config.effectLayerOverrides.fire).toBe("front");
  });
});
