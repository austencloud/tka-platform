import { describe, it, expect } from "vitest";
import { migrateEffectsConfig } from "$lib/shared/effects/domain/migrations";
import { EFFECTS_CONFIG_VERSION } from "$lib/shared/effects/domain/effects-config";

describe("menagerie migration (v30)", () => {
  it("moves a serpent silk config into menagerie and resets silk to ribbon", () => {
    const raw = {
      version: 29,
      silk: {
        form: "serpent",
        creature: "dragon",
        palette: "ember",
        customColor: "#ff6000",
        intensity: 0.9,
        width: 0.6,
        bodyLength: 0.7,
        slither: 0.45,
        trackingMode: "right_end",
        duration: 0.5,
        flutter: 0.3,
        tautness: 0.5,
      },
      tipEffectMap: { "0:0": { effect: "silk" } },
      activePresets: { silk: "silk-dragon" },
      activeEffect: "silk",
    };
    const out = migrateEffectsConfig(raw);
    expect(out.version).toBe(EFFECTS_CONFIG_VERSION);
    // Menagerie received the creature fields.
    expect(out.menagerie.creature).toBe("dragon");
    expect(out.menagerie.palette).toBe("ember");
    expect(out.menagerie.bodyLength).toBeCloseTo(0.7);
    // Silk is back to ribbon (no serpent fields survive).
    expect((out.silk as Record<string, unknown>).form).toBeUndefined();
    // Tip + active state re-pointed at menagerie.
    expect(out.tipEffectMap["0:0"]!.effect).toBe("menagerie");
    expect(out.activePresets.menagerie).toBe("menagerie-dragon");
    expect(out.activeEffect).toBe("menagerie");
  });

  it("leaves a ribbon silk config as silk", () => {
    const raw = {
      version: 29,
      silk: { form: "ribbon", palette: "satin", intensity: 0.7 },
      tipEffectMap: { "0:0": { effect: "silk" } },
      activePresets: { silk: "silk-classic" },
      activeEffect: "silk",
    };
    const out = migrateEffectsConfig(raw);
    expect(out.tipEffectMap["0:0"]!.effect).toBe("silk");
    expect(out.activeEffect).toBe("silk");
    expect(out.activePresets.silk).toBe("silk-classic");
  });

  it("neutralizes persisted frost usage", () => {
    const raw = {
      version: 29,
      tipEffectMap: { "0:0": { effect: "frost" }, "1:0": { effect: "trails" } },
      activePresets: { frost: "frost-classic" },
      activeEffect: "frost",
    };
    const out = migrateEffectsConfig(raw);
    expect(out.tipEffectMap["0:0"]).toBeUndefined();
    expect(out.tipEffectMap["1:0"]!.effect).toBe("trails");
    // The persisted "frost-classic" pick is cleared; the dormant frost slot
    // resolves back to its default (null), not the stale preset id.
    expect((out.activePresets as Record<string, unknown>).frost).toBeNull();
    expect(out.activeEffect).toBe("none");
  });

  it("passes a current-version config through unchanged", () => {
    const raw = { version: EFFECTS_CONFIG_VERSION, activeEffect: "silk" };
    const out = migrateEffectsConfig(raw);
    expect(out.version).toBe(EFFECTS_CONFIG_VERSION);
    expect(out.activeEffect).toBe("silk");
  });
});
