/**
 * Honest preset matching — pins the phantom-highlight fix.
 *
 * The bug: selecting an effect loaded its base default config, yet the
 * "Choose a Look" row highlighted a named preset (e.g. Supernova). The matcher
 * must light a chip ONLY when the live config equals that preset's patch, and
 * leave the base default matching nothing.
 */

import { describe, it, expect } from "vitest";
import { configMatchesPatch, matchPresetId } from "./match-preset";
import { BLOOM_PRESET_GROUP, BLOOM_PRESETS } from "./bloom-presets";
import { DEFAULT_EFFECTS_CONFIG } from "$lib/shared/effects/domain/defaults";

const SUPERNOVA = BLOOM_PRESETS.find((p) => p.id === "bloom-supernova")!;
const COMET = BLOOM_PRESETS.find((p) => p.id === "bloom-comet")!;

describe("configMatchesPatch", () => {
  it("matches when every patched field equals the config", () => {
    const cfg = { intensity: 0.9, radius: 50, extra: "ignored" };
    expect(configMatchesPatch(cfg, { intensity: 0.9, radius: 50 })).toBe(true);
  });

  it("does not match when any patched field differs", () => {
    const cfg = { intensity: 0.5, radius: 50 };
    expect(configMatchesPatch(cfg, { intensity: 0.9, radius: 50 })).toBe(false);
  });

  it("compares string-array fields (palettes) structurally", () => {
    const cfg = { palette: ["#a", "#b", "#c"] };
    expect(configMatchesPatch(cfg, { palette: ["#a", "#b", "#c"] })).toBe(true);
    expect(configMatchesPatch(cfg, { palette: ["#a", "#b"] })).toBe(false);
    expect(configMatchesPatch(cfg, { palette: ["#a", "#x", "#c"] })).toBe(false);
  });

  it("never matches an empty patch (the Custom-chip case)", () => {
    expect(configMatchesPatch({ intensity: 0.5 }, {})).toBe(false);
  });
});

describe("matchPresetId", () => {
  it("returns null for the bloom base default (the phantom-highlight fix)", () => {
    // This is the exact bug: base default must light NO chip — not Supernova.
    const bloomDefault = DEFAULT_EFFECTS_CONFIG.bloom as unknown as Record<string, unknown>;
    expect(matchPresetId(BLOOM_PRESET_GROUP, bloomDefault)).toBeNull();
  });

  it("highlights Supernova only when the config equals Supernova's patch", () => {
    const cfg = { ...DEFAULT_EFFECTS_CONFIG.bloom, ...SUPERNOVA.patch } as Record<string, unknown>;
    expect(matchPresetId(BLOOM_PRESET_GROUP, cfg)).toBe("bloom-supernova");
  });

  it("highlights Comet when the config equals Comet's patch", () => {
    const cfg = { ...DEFAULT_EFFECTS_CONFIG.bloom, ...COMET.patch } as Record<string, unknown>;
    expect(matchPresetId(BLOOM_PRESET_GROUP, cfg)).toBe("bloom-comet");
  });

  it("returns null once a single field is tuned off a matching preset", () => {
    const cfg = {
      ...DEFAULT_EFFECTS_CONFIG.bloom,
      ...SUPERNOVA.patch,
      intensity: 0.42, // hand-tuned away from Supernova's 0.9
    } as Record<string, unknown>;
    expect(matchPresetId(BLOOM_PRESET_GROUP, cfg)).toBeNull();
  });

  it("never auto-matches the empty-patch Custom chip", () => {
    // bloom-custom has patch: {} — it must never be returned by the matcher,
    // even for the base default. (Its highlight comes from the explicit signal.)
    const anyConfig = { intensity: 0.123 } as Record<string, unknown>;
    expect(matchPresetId(BLOOM_PRESET_GROUP, anyConfig)).not.toBe("bloom-custom");
  });
});
