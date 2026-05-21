import { describe, it, expect } from "vitest";
import { createAvatarInstanceState, makeStandaloneDeps } from "$lib/shared/3d/state/avatar-instance-state.svelte";

function makeConfig(id = "p1") { return { id, positionX: 0 }; }
function makeDeps() { return makeStandaloneDeps(); }

describe("AvatarInstanceState — effort read is per-performer", () => {
  it("effortPreset reflects effective effortId (default linear from cascade)", () => {
    const a = createAvatarInstanceState(makeConfig(), makeDeps());
    expect(a.effortPreset).toBe("linear");
  });

  it("changing settings via setEffort updates raw effortId", () => {
    // effortPreset reads $derived(effectiveEffortId) — $derived values
    // don't re-evaluate after mutation without a Svelte reactive context.
    // Test the raw state instead; cascade resolution tested in integration.
    const a = createAvatarInstanceState(makeConfig(), makeDeps());
    a.setEffort("glide");
    expect(a.settings.effortId).toBe("glide");
  });

  it("two independent instances have independent efforts", () => {
    const a = createAvatarInstanceState(makeConfig("p1"), makeDeps());
    const b = createAvatarInstanceState(makeConfig("p2"), makeDeps());
    a.setEffort("press");
    b.setEffort("punch");
    expect(a.settings.effortId).toBe("press");
    expect(b.settings.effortId).toBe("punch");
  });
});
