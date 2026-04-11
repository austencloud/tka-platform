import { describe, it, expect } from "vitest";
import { AnimationVisibilityStateManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
import { snapshotConfigFromVm } from "$lib/shared/effects/compat/vm-shim";
import { DEFAULT_EFFECTS_CONFIG } from "$lib/shared/effects/domain/defaults";

describe("snapshotConfigFromVm", () => {
  it("returns a full EffectsConfig from a fresh vm", () => {
    const vm = new AnimationVisibilityStateManager({ ephemeral: true });
    const config = snapshotConfigFromVm(vm);
    expect(config.version).toBe(DEFAULT_EFFECTS_CONFIG.version);
    expect(config.fire.intensity).toBeGreaterThanOrEqual(0.45);
    expect(config.led.patternId).toBeTypeOf("string");
    expect(config.charcoal.intensity).toBeGreaterThanOrEqual(0);
    expect(config.tipEffectMap).toBeTypeOf("object");
  });

  it("reflects fire intensity changes on vm", () => {
    const vm = new AnimationVisibilityStateManager({ ephemeral: true });
    vm.setFireIntensity(0.9);
    const config = snapshotConfigFromVm(vm);
    expect(config.fire.intensity).toBe(0.9);
  });

  it("reflects LED primary color changes on vm", () => {
    const vm = new AnimationVisibilityStateManager({ ephemeral: true });
    vm.setLedPrimaryColor("#abcdef");
    const config = snapshotConfigFromVm(vm);
    expect(config.led.primaryColor).toBe("#abcdef");
  });

  it("reflects tipEffectMap changes on vm", () => {
    const vm = new AnimationVisibilityStateManager({ ephemeral: true });
    vm.setActiveEffect("fire");
    const config = snapshotConfigFromVm(vm);
    expect(config.tipEffectMap["*"]?.effect).toBe("fire");
  });
});
