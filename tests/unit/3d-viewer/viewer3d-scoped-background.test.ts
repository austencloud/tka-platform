import { afterEach, describe, expect, it } from "vitest";
import { createViewer3DStateForTest } from "./viewer3d-test-helpers.svelte";

const disposals: Array<() => void> = [];

afterEach(() => {
  while (disposals.length) disposals.pop()!();
});

describe("Viewer 3D scoped environment", () => {
  it("changes an isolated viewer without requiring the global settings owner", () => {
    const { state, dispose } = createViewer3DStateForTest({
      backgroundType: "blossom",
    });
    disposals.push(dispose);

    expect(state.environmentId).toBe("blossom");
    state.setEnvironmentId("ocean");
    expect(state.environmentId).toBe("ocean");
  });
});
