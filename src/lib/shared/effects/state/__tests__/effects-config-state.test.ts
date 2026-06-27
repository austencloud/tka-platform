import { describe, it, expect, vi } from "vitest";
import { DEFAULT_EFFECTS_CONFIG } from "../../domain/defaults";

// Mock the scene undo manager before importing the module under test.
// Module path is `get-scene-undo-manager` (Phase C kebab rename) — mocking the
// old `getSceneUndoManager` path silently never attaches. Shared hoisted spies
// let the undo call-count assertions below observe the real instance.
const undoSpies = vi.hoisted(() => ({
  registerDomain: vi.fn(),
  captureState: vi.fn(),
  commitState: vi.fn(),
  commitStateCoalescing: vi.fn(),
}));

vi.mock("$lib/shared/3d/undo/get-scene-undo-manager", () => ({
  getSceneUndoManager: () => undoSpies,
}));

const { createEffectsConfigState } = await import("../effects-config-state.svelte");

describe("EffectsConfigState", () => {
  describe("updateEffect", () => {
    it("updates a specific effect by id", () => {
      const state = createEffectsConfigState();
      state.updateEffect("fire", { intensity: 0.9 });
      expect(state.fire.intensity).toBe(0.9);
    });

    it("clears active preset for the effect", () => {
      const state = createEffectsConfigState();
      state.updateEffect("fire", { intensity: 0.5 });
      expect(state.activePresets.fire).toBeNull();
    });

    it("preserves other fields when patching", () => {
      const state = createEffectsConfigState();
      const originalBlend = state.fire.colorBlend;
      state.updateEffect("fire", { intensity: 0.3 });
      expect(state.fire.colorBlend).toBe(originalBlend);
    });

    it("throws for unknown effect id", () => {
      const state = createEffectsConfigState();
      expect(() => state.updateEffect("bogus" as any, {})).toThrow("Unknown effect id");
    });
  });

  describe("custom snapshots + core preset (Default / Custom chips)", () => {
    it("hasCustom is false at the shipped default", () => {
      const state = createEffectsConfigState(undefined, { persist: false });
      expect(state.hasCustom("bloom")).toBe(false);
    });

    it("updateEffect captures the live config as the custom snapshot", () => {
      const state = createEffectsConfigState(undefined, { persist: false });
      state.updateEffect("bloom", { intensity: 0.123 });
      expect(state.hasCustom("bloom")).toBe(true);
      expect(state.customSnapshot("bloom")?.intensity).toBe(0.123);
    });

    it("applyPreset does NOT overwrite the custom snapshot", () => {
      const state = createEffectsConfigState(undefined, { persist: false });
      state.updateEffect("bloom", { intensity: 0.123 });
      state.applyPreset("bloom", "bloom-supernova", { intensity: 1, radius: 50 });
      expect(state.bloom.intensity).toBe(1); // preset applied to live config
      expect(state.customSnapshot("bloom")?.intensity).toBe(0.123); // snapshot preserved
    });

    it("restoreCustom returns the pre-preset tuning", () => {
      const state = createEffectsConfigState(undefined, { persist: false });
      state.updateEffect("bloom", { intensity: 0.123, radius: 41 });
      state.applyPreset("bloom", "bloom-supernova", { intensity: 1, radius: 50 });
      state.restoreCustom("bloom");
      expect(state.bloom.intensity).toBe(0.123);
      expect(state.bloom.radius).toBe(41);
      expect(state.activePresets.bloom).toBeNull();
    });

    it("resetToShipped returns factory default and leaves the snapshot intact", () => {
      const state = createEffectsConfigState(undefined, { persist: false });
      state.updateEffect("bloom", { intensity: 0.123 });
      state.resetToShipped("bloom");
      expect(state.bloom.intensity).toBe(DEFAULT_EFFECTS_CONFIG.bloom.intensity);
      expect(state.activePresets.bloom).toBeNull();
      expect(state.hasCustom("bloom")).toBe(true); // your look is still recoverable
      expect(state.customSnapshot("bloom")?.intensity).toBe(0.123);
    });
  });

  describe("applyPreset", () => {
    it("merges the patch into the target effect's intent", () => {
      const state = createEffectsConfigState();
      state.applyPreset("led", "led-green-glow", { brightness: 4, patternId: "solid" });
      expect(state.led.brightness).toBe(4);
      expect(state.led.patternId).toBe("solid");
    });

    it("sets activePresets[effectType] to the preset id", () => {
      const state = createEffectsConfigState();
      state.applyPreset("led", "led-green-glow", { brightness: 4 });
      expect(state.activePresets.led).toBe("led-green-glow");
    });

    it("preserves untouched fields of the intent", () => {
      const state = createEffectsConfigState();
      const originalSpeed = state.led.patternSpeed;
      state.applyPreset("led", "led-green-glow", { brightness: 2 });
      expect(state.led.patternSpeed).toBe(originalSpeed);
    });

    it("a subsequent updateEffect on the same effect nulls the active preset", () => {
      const state = createEffectsConfigState();
      state.applyPreset("led", "led-green-glow", { brightness: 2 });
      expect(state.activePresets.led).toBe("led-green-glow");
      state.updateEffect("led", { brightness: 3 });
      expect(state.activePresets.led).toBeNull();
    });

    it("records exactly ONE undo capture/commit pair per apply (pins the double-undo fix)", () => {
      const state = createEffectsConfigState();
      undoSpies.captureState.mockClear();
      undoSpies.commitState.mockClear();
      undoSpies.commitStateCoalescing.mockClear();
      state.applyPreset("led", "led-green-glow", { brightness: 4 });
      expect(undoSpies.captureState).toHaveBeenCalledTimes(1);
      expect(undoSpies.commitState).toHaveBeenCalledTimes(1);
      // The old two-call hack also ran commitStateCoalescing via updateEffect.
      // The honest single-step apply must not.
      expect(undoSpies.commitStateCoalescing).not.toHaveBeenCalled();
    });
  });

  describe("activeEffect management", () => {
    it("defaults to 'none'", () => {
      const state = createEffectsConfigState();
      expect(state.activeEffect).toBe("none");
    });

    it("setActiveEffect updates activeEffect and tipEffectMap", () => {
      const state = createEffectsConfigState();
      state.setActiveEffect("fire");
      expect(state.activeEffect).toBe("fire");
      expect(state.tipEffectMap).toEqual({ "*": { effect: "fire" } });
    });

    it("setActiveEffect('none') clears tipEffectMap", () => {
      const state = createEffectsConfigState();
      state.setActiveEffect("fire");
      state.setActiveEffect("none");
      expect(state.activeEffect).toBe("none");
      expect(state.tipEffectMap).toEqual({});
    });
  });

  describe("baseline (Save Defaults / Reset)", () => {
    it("saveAsBaseline + resetToBaseline round-trips the saved snapshot", () => {
      const state = createEffectsConfigState();
      state.updateEffect("fire", { brightness: 0.3 });
      state.saveAsBaseline();
      state.updateEffect("fire", { brightness: 0.9 });
      state.resetToBaseline();
      expect(state.fire.brightness).toBe(0.3);
    });

    it("resetToBaseline with no baseline returns to factory defaults", () => {
      // persist:false isolates this instance — the sibling saveAsBaseline test above
      // persists a baseline to localStorage that would otherwise leak in here.
      const state = createEffectsConfigState(undefined, { persist: false });
      state.updateEffect("fire", { brightness: 0.1 });
      state.resetToBaseline();
      // Factory default for fire.brightness is 0.5 (1.0→0.5 in commit 32a92a4987 "tame 3D fire").
      // Canonical source: src/lib/shared/effects/domain/defaults.ts:21.
      expect(state.fire.brightness).toBe(0.5);
    });

    it("baseline is a snapshot, not a live reference", () => {
      const state = createEffectsConfigState();
      state.updateEffect("fire", { intensity: 0.4 });
      state.saveAsBaseline();
      // mutating after save must not bleed into the baseline
      state.updateEffect("fire", { intensity: 0.95 });
      state.resetToBaseline();
      expect(state.fire.intensity).toBe(0.4);
    });
  });

  describe("effectLayerOverrides", () => {
    it("getEffectLayer returns 'behind' by default", () => {
      const state = createEffectsConfigState();
      expect(state.getEffectLayer("fire")).toBe("behind");
    });

    it("setEffectLayer stores override", () => {
      const state = createEffectsConfigState();
      state.setEffectLayer("fire", "front");
      expect(state.getEffectLayer("fire")).toBe("front");
    });

    it("setEffectLayer('behind') removes entry from map", () => {
      const state = createEffectsConfigState();
      state.setEffectLayer("fire", "front");
      state.setEffectLayer("fire", "behind");
      expect(state.effectLayerOverrides).toEqual({});
    });
  });
});
