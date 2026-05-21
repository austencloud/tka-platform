import { describe, it, expect } from "vitest";
import { createAvatarInstanceState, makeStandaloneDeps } from "$lib/shared/3d/state/avatar-instance-state.svelte";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

function makeConfig() {
  return { id: "p1", positionX: 0 };
}
function makeDeps() {
  return makeStandaloneDeps();
}

describe("AvatarInstanceState — performer settings", () => {
  it("starts with null raw settings (inherits from defaults)", () => {
    const a = createAvatarInstanceState(makeConfig(), makeDeps());
    expect(a.settings.effortId).toBeNull();
    expect(a.settings.prop).toBeNull();
    expect(a.settings.effects).toBeNull();
  });

  it("effective values resolve to defaults when raw settings are null", () => {
    // $derived values evaluate correctly on first read (before any mutation)
    const a = createAvatarInstanceState(makeConfig(), makeDeps());
    expect(a.effectiveEffortId).toBe("linear");
    expect(a.effectiveProp).toBe(PropType.STAFF);
    expect(a.effectiveEffects.size).toBe(0);
  });

  it("setEffort updates raw effortId", () => {
    const a = createAvatarInstanceState(makeConfig(), makeDeps());
    a.setEffort("glide");
    expect(a.settings.effortId).toBe("glide");
    // NOTE: effectiveEffortId is $derived — re-evaluation after mutation
    // requires a Svelte reactive context (component/effect root), so we
    // only assert the raw state here. Cascade resolution tested in integration.
  });

  it("setProp updates raw prop", () => {
    const a = createAvatarInstanceState(makeConfig(), makeDeps());
    a.setProp(PropType.FAN);
    expect(a.settings.prop).toBe(PropType.FAN);
  });

  it("toggleEffect adds an inactive effect", () => {
    const a = createAvatarInstanceState(makeConfig(), makeDeps());
    a.toggleEffect("trails");
    expect(a.settings.effects!.has("trails")).toBe(true);
  });

  it("toggleEffect removes an already-active effect", () => {
    const a = createAvatarInstanceState(makeConfig(), makeDeps());
    a.toggleEffect("fire");
    a.toggleEffect("fire");
    expect(a.settings.effects!.has("fire")).toBe(false);
  });

  it("hasOverride starts false for all categories", () => {
    const a = createAvatarInstanceState(makeConfig(), makeDeps());
    expect(a.hasOverride.prop).toBe(false);
    expect(a.hasOverride.effects).toBe(false);
    expect(a.hasOverride.effort).toBe(false);
    expect(a.hasOverride.planes).toBe(false);
    expect(a.hasAnyOverride).toBe(false);
  });

  it("resetProp clears prop override to null", () => {
    const a = createAvatarInstanceState(makeConfig(), makeDeps());
    a.setProp(PropType.FAN);
    expect(a.settings.prop).toBe(PropType.FAN);
    a.resetProp();
    expect(a.settings.prop).toBeNull();
  });

  it("resetEffort clears effort override to null", () => {
    const a = createAvatarInstanceState(makeConfig(), makeDeps());
    a.setEffort("glide");
    expect(a.settings.effortId).toBe("glide");
    a.resetEffort();
    expect(a.settings.effortId).toBeNull();
  });

  it("resetEffects clears effects override to null", () => {
    const a = createAvatarInstanceState(makeConfig(), makeDeps());
    a.toggleEffect("trails");
    expect(a.settings.effects).not.toBeNull();
    a.resetEffects();
    expect(a.settings.effects).toBeNull();
  });

  it("resetAllOverrides clears all settings to null, preserves staffLengthCm", () => {
    const a = createAvatarInstanceState(makeConfig(), makeDeps());
    a.setProp(PropType.FAN);
    a.setEffort("glide");
    a.toggleEffect("trails");
    a.setStaffLengthCm(120);
    a.resetAllOverrides();
    expect(a.settings.prop).toBeNull();
    expect(a.settings.effortId).toBeNull();
    expect(a.settings.effects).toBeNull();
    expect(a.settings.staffLengthCm).toBe(120);
  });
});
