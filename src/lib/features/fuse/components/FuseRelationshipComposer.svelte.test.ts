import { render } from "vitest-browser-svelte";
import { page } from "vitest/browser";
import { describe, expect, it, vi } from "vitest";
import type { FuseState } from "../state/fuse-state.svelte";
import FuseRelationshipComposerTestHarness from "./FuseRelationshipComposerTestHarness.svelte";

function relationshipState(): FuseState {
  return {
    mode: "symmetry",
    driverSide: "blue",
    transformId: "mirror",
    isLoadingLength: false,
    pendingSide: null,
    isFusing: false,
    setMode: vi.fn(),
    setRelationship: vi.fn(),
    previewRelationship: vi.fn().mockResolvedValue(undefined),
    cancelRelationshipPreview: vi.fn(),
  } as unknown as FuseState;
}

describe("FuseRelationshipComposer", () => {
  it("rebuilds the follower as soon as a relationship rule is selected", async () => {
    const state = relationshipState();
    render(FuseRelationshipComposerTestHarness, { state });

    await page.getByRole("radio", { name: /Rotate 90/ }).click();

    expect(state.previewRelationship).toHaveBeenLastCalledWith(
      "blue",
      "rotate90"
    );

    await page.getByRole("button", { name: "Use this relationship" }).click();
    expect(state.setRelationship).toHaveBeenCalledWith("blue", "rotate90");

    await page.getByRole("button", { name: "Cancel" }).click();
    expect(state.cancelRelationshipPreview).toHaveBeenCalled();
  });
});
