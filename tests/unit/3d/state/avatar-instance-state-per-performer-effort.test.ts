import { describe, it, expect } from "vitest";
import { createAvatarInstanceState } from "$lib/shared/3d/state/avatar-instance-state.svelte";

function makeConfig(id = "p1") { return { id, positionX: 0 }; }
function makeDeps() { return {} as any; }

describe("AvatarInstanceState — effort read is per-performer", () => {
  it("effortPreset reflects settings.effortId (default linear)", () => {
    const a = createAvatarInstanceState(makeConfig(), makeDeps());
    expect(a.effortPreset).toBe("linear");
  });

  it("changing settings via setEffort updates effortPreset reactively", () => {
    const a = createAvatarInstanceState(makeConfig(), makeDeps());
    a.setEffort("glide");
    expect(a.effortPreset).toBe("glide");
  });

  it("two independent instances have independent efforts", () => {
    const a = createAvatarInstanceState(makeConfig("p1"), makeDeps());
    const b = createAvatarInstanceState(makeConfig("p2"), makeDeps());
    a.setEffort("press");
    b.setEffort("punch");
    expect(a.effortPreset).toBe("press");
    expect(b.effortPreset).toBe("punch");
  });
});
