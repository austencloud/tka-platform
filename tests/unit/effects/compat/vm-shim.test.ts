import { describe, it, expect } from "vitest";
import { AnimationVisibilityStateManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
import { snapshotConfigFromVm, bindVmToEffectsConfig } from "$lib/shared/effects/compat/vm-shim";
import { DEFAULT_EFFECTS_CONFIG } from "$lib/shared/effects/domain/defaults";
import { createEffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";

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

describe("bindVmToEffectsConfig", () => {
  it("propagates vm.setFireIntensity into canonical state", () => {
    const vm = new AnimationVisibilityStateManager({ ephemeral: true });
    const state = createEffectsConfigState();
    const dispose = bindVmToEffectsConfig(vm, state);

    vm.setFireIntensity(0.92);

    expect(state.config.fire.intensity).toBe(0.92);
    dispose();
  });

  it("propagates vm.setLedPrimaryColor into canonical state", () => {
    const vm = new AnimationVisibilityStateManager({ ephemeral: true });
    const state = createEffectsConfigState();
    const dispose = bindVmToEffectsConfig(vm, state);

    vm.setLedPrimaryColor("#123456");

    expect(state.config.led.primaryColor).toBe("#123456");
    dispose();
  });

  it("propagates vm.setActiveEffect into canonical tipEffectMap", () => {
    const vm = new AnimationVisibilityStateManager({ ephemeral: true });
    const state = createEffectsConfigState();
    const dispose = bindVmToEffectsConfig(vm, state);

    vm.setActiveEffect("fire");

    expect(state.config.tipEffectMap["*"]?.effect).toBe("fire");
    dispose();
  });

  it("dispose stops propagation", () => {
    const vm = new AnimationVisibilityStateManager({ ephemeral: true });
    const state = createEffectsConfigState();
    const dispose = bindVmToEffectsConfig(vm, state);
    dispose();

    vm.setFireIntensity(0.99);

    expect(state.config.fire.intensity).not.toBe(0.99);
  });
});
