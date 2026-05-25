import { describe, it, expect, vi } from "vitest";

// Mock getSceneUndoManager before importing the module under test
vi.mock("$lib/shared/3d/undo/getSceneUndoManager", () => ({
  getSceneUndoManager: () => ({
    registerDomain: vi.fn(),
    captureState: vi.fn(),
    commitState: vi.fn(),
    commitStateCoalescing: vi.fn(),
  }),
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
