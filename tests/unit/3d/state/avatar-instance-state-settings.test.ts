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
    expect(a.settings.effect).toBeNull();
  });

  it("effective values resolve to defaults when raw settings are null", () => {
    // $derived values evaluate correctly on first read (before any mutation)
    const a = createAvatarInstanceState(makeConfig(), makeDeps());
    expect(a.effectiveEffortId).toBe("linear");
    expect(a.effectiveProp).toBe(PropType.STAFF);
    // The effect override starts null (inherit the global default).
    expect(a.rawEffect).toBeNull();
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

  it("setEffect sets the single active effect (radio)", () => {
    const a = createAvatarInstanceState(makeConfig(), makeDeps());
    a.setEffect("trails");
    expect(a.settings.effect).toBe("trails");
    // Selecting another replaces it - one effect at a time.
    a.setEffect("fire");
    expect(a.settings.effect).toBe("fire");
  });

  it("setEffect('none') turns the effect explicitly off", () => {
    const a = createAvatarInstanceState(makeConfig(), makeDeps());
    a.setEffect("fire");
    a.setEffect("none");
    expect(a.settings.effect).toBe("none");
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

  it("resetEffects clears the effect override to null (inherit)", () => {
    const a = createAvatarInstanceState(makeConfig(), makeDeps());
    a.setEffect("trails");
    expect(a.settings.effect).toBe("trails");
    a.resetEffects();
    expect(a.settings.effect).toBeNull();
  });

  it("displayName starts null and setDisplayName assigns / trims / clears", () => {
    const a = createAvatarInstanceState(makeConfig(), makeDeps());
    expect(a.displayName).toBeNull();
    a.setDisplayName("  Jade  ");
    expect(a.displayName).toBe("Jade"); // trimmed
    a.setDisplayName("");
    expect(a.displayName).toBeNull(); // empty clears the override
    a.setDisplayName("Nova");
    a.setDisplayName(null);
    expect(a.displayName).toBeNull();
  });

  it("resetAllOverrides clears all settings to null, preserves staffLengthCm", () => {
    const a = createAvatarInstanceState(makeConfig(), makeDeps());
    a.setProp(PropType.FAN);
    a.setEffort("glide");
    a.setEffect("trails");
    a.setStaffLengthCm(120);
    a.resetAllOverrides();
    expect(a.settings.prop).toBeNull();
    expect(a.settings.effortId).toBeNull();
    expect(a.settings.effect).toBeNull();
    expect(a.settings.staffLengthCm).toBe(120);
  });
});
