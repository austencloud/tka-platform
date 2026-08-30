import { describe, it, expect, vi, afterEach } from "vitest";
import { captureFxSlice, seedFromFxSlice } from "./fx-slice";
import { createEffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
import { DEFAULT_EFFECTS_CONFIG } from "$lib/shared/effects/domain/defaults";

afterEach(() => vi.restoreAllMocks());

describe("fx slice", () => {
  it("returns null at factory defaults", () => {
    const state = createEffectsConfigState(undefined, { persist: false });
    expect(captureFxSlice(state)).toBeNull();
  });

  it("captures only the keys that differ from defaults", () => {
    const state = createEffectsConfigState(undefined, { persist: false });
    state.setActiveEffect("sparkles");
    state.updateEffect("sparkles", { rate: 0.92 });
    const slice = captureFxSlice(state);
    expect(slice?.active).toBe("sparkles");
    expect(slice?.tuning?.sparkles).toMatchObject({ rate: 0.92 });
    expect(slice?.tuning && "fire" in slice.tuning).toBe(false);
  });

  it("round-trips: capture -> seed -> new instance -> capture is identity", () => {
    const a = createEffectsConfigState(undefined, { persist: false });
    a.setActiveEffect("sparkles");
    a.updateEffect("sparkles", { rate: 0.92 });
    const slice = captureFxSlice(a);

    const b = createEffectsConfigState(seedFromFxSlice(slice!), { persist: false });
    expect(captureFxSlice(b)).toEqual(slice);
    expect(b.activeEffect).toBe("sparkles");
  });

  it("seeding + reading performs zero localStorage writes", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const state = createEffectsConfigState(
      seedFromFxSlice({ active: "sparkles", tuning: { sparkles: { rate: 0.92 } } }),
      { persist: false }
    );
    state.updateEffect("sparkles", { rate: 0.5 }); // tweaks during a link session stay session-local
    expect(setItem).not.toHaveBeenCalled();
  });

  it("seedFromFxSlice merges onto factory defaults, not user state", () => {
    const seeded = seedFromFxSlice({ active: "fire" });
    expect(seeded.activeEffect).toBe("fire");
    expect(seeded.sparkles).toEqual(DEFAULT_EFFECTS_CONFIG.sparkles);
  });
});
