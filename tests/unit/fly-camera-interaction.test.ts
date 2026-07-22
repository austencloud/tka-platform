import { describe, expect, it } from "vitest";
import {
  CLEAN_FLY_INTERACTION,
  flushFlyInteraction,
  markFlyInteractionDirty,
} from "$lib/shared/3d/domain/fly-interaction-dirty";

describe("fly camera interaction boundaries", () => {
  it("flushes repeated pointer activity as one completed interaction", () => {
    let state = markFlyInteractionDirty(CLEAN_FLY_INTERACTION, "pointer");
    state = markFlyInteractionDirty(state, "pointer");

    const first = flushFlyInteraction(state);
    expect(first.kind).toBe("pointer");
    expect(flushFlyInteraction(first.state).kind).toBeNull();
  });

  it("collapses keyboard and pointer activity into one mixed interaction", () => {
    let state = markFlyInteractionDirty(CLEAN_FLY_INTERACTION, "keyboard");
    state = markFlyInteractionDirty(state, "pointer");

    const result = flushFlyInteraction(state);
    expect(result.kind).toBe("mixed");
    expect(result.state).toEqual(CLEAN_FLY_INTERACTION);
  });
});
