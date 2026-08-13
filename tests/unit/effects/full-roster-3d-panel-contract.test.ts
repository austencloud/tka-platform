import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const panel = readFileSync(
  resolve("src/lib/shared/3d/components/controls/EffectsSettingsPanel.svelte"),
  "utf8"
);
const orchestrator = readFileSync(
  resolve("src/lib/shared/3d/effects/EffectOrchestrator3D.svelte"),
  "utf8"
);

describe("3D full-roster contract", () => {
  it("maps the canonical effect registry directly without a second allowlist", () => {
    expect(panel).toContain("EFFECTS.map");
    expect(panel).not.toContain("EFFECTS.filter");
    expect(panel).not.toContain("EFFECTS_WITH_3D_RENDERER");
  });

  it("keeps Motion separate from the canonical effect radio group", () => {
    expect(panel).toContain('class="scene-modifier"');
    expect(panel).toContain('key: "motion" as const');
  });

  it("exposes each active effect's canonical presets in the regular 3D panel", () => {
    expect(panel).toContain("EffectPresetsSection");
    expect(panel).toContain("getRegistration(activeEffectId)");
    expect(panel).toContain("matchPresetId(activeRegistration.presetGroup");
    expect(panel).toContain("config.applyPreset(");
    expect(panel).not.toContain("BLOOM_PRESETS");
  });

  it("resolves and publishes all four formerly missing effects", () => {
    for (const effect of ["Ink", "Silk", "Animal", "Pulse"]) {
      expect(orchestrator).toContain(`resolve${effect}3D`);
    }
    for (const effect of ["ink", "silk", "animal", "pulse"]) {
      expect(orchestrator).toContain(`case "${effect}"`);
    }
  });
});
