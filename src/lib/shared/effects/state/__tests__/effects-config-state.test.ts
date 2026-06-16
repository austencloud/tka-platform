import { describe, it, expect, vi } from "vitest";

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
