import { describe, it, expect } from "vitest";
import { createAvatarInstanceState } from "$lib/shared/3d/state/avatar-instance-state.svelte";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

function makeConfig() {
  return { id: "p1", positionX: 0 };
}
function makeDeps() {
  return {} as any;
}

describe("AvatarInstanceState — performer settings", () => {
  it("starts with default settings (linear effort, STAFF prop, no effects)", () => {
    const a = createAvatarInstanceState(makeConfig(), makeDeps());
    expect(a.settings.effortId).toBe("linear");
    expect(a.settings.prop).toBe(PropType.STAFF);
    expect(a.settings.effects.size).toBe(0);
  });

  it("setEffort updates effortId", () => {
    const a = createAvatarInstanceState(makeConfig(), makeDeps());
    a.setEffort("glide");
    expect(a.settings.effortId).toBe("glide");
  });

  it("setProp updates prop", () => {
    const a = createAvatarInstanceState(makeConfig(), makeDeps());
    a.setProp(PropType.FAN);
    expect(a.settings.prop).toBe(PropType.FAN);
  });

  it("toggleEffect adds an inactive effect", () => {
    const a = createAvatarInstanceState(makeConfig(), makeDeps());
    a.toggleEffect("trails");
    expect(a.settings.effects.has("trails")).toBe(true);
  });

  it("toggleEffect removes an already-active effect", () => {
    const a = createAvatarInstanceState(makeConfig(), makeDeps());
    a.toggleEffect("fire");
    a.toggleEffect("fire");
    expect(a.settings.effects.has("fire")).toBe(false);
  });
});
