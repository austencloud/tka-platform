import { render } from "vitest-browser-svelte";
import { page } from "vitest/browser";
import { describe, expect, it, vi } from "vitest";
import { createFuseRule } from "../domain/fuse-rule";
import type { FuseState } from "../state/fuse-state.svelte";
import FuseRelationshipComposerTestHarness from "./FuseRelationshipComposerTestHarness.svelte";

function relationshipState(): FuseState {
  return {
    mode: "symmetry",
    driverSide: "blue",
    rule: createFuseRule({ reflect: "mirror" }),
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
  it("rebuilds the follower as soon as a rule axis changes", async () => {
    const state = relationshipState();
    render(FuseRelationshipComposerTestHarness, { state });

    // Rotation is its own axis now, so choosing an amount leaves the mirror
    // that was already on the rule in place rather than replacing it.
    await page.getByRole("radio", { name: "90° clockwise" }).click();

    const rotatedMirror = createFuseRule({
      rotationSteps: 2,
      reflect: "mirror",
    });
    expect(state.previewRelationship).toHaveBeenLastCalledWith(
      "blue",
      rotatedMirror
    );

    await page.getByRole("button", { name: "Use this relationship" }).click();
    expect(state.setRelationship).toHaveBeenCalledWith("blue", rotatedMirror);

    await page.getByRole("button", { name: "Cancel" }).click();
    expect(state.cancelRelationshipPreview).toHaveBeenCalled();
  });

  it("keeps the independent operations independent of the reflection", async () => {
    const state = relationshipState();
    render(FuseRelationshipComposerTestHarness, { state });

    await page.getByRole("radio", { name: "Flip" }).click();
    await page.getByRole("button", { name: /^Invert/ }).click();

    expect(state.previewRelationship).toHaveBeenLastCalledWith(
      "blue",
      createFuseRule({ reflect: "flip", invert: true })
    );
  });
});
