import { describe, it, expect, beforeEach } from "vitest";
import { releaserState } from "../deck-releaser-state.svelte";

describe("deck-releaser recipe round-trip", () => {
  beforeEach(() => releaserState.reset());

  it("toRecipe stamps seed + generatorVersion + new axes", () => {
    releaserState.seed = "fixed-seed";
    releaserState.selectedLoopTypes = new Set(["rotated"]);
    releaserState.selectedLevels = new Set([1]);
    const r = releaserState.toRecipe();
    expect(r.seed).toEqual("fixed-seed");
    expect(r.generatorVersion).toBeTruthy();
    expect(r.loopTypes).toEqual(["rotated"]);
    expect(r.levels).toEqual([1]);
  });

  it("loadRecipe restores seed + axes (reproduce exactly)", () => {
    const r = releaserState.toRecipe();
    r.seed = "stored-seed";
    r.loopTypes = ["inverted"];
    releaserState.loadRecipe(r);
    expect(releaserState.seed).toEqual("stored-seed");
    expect([...releaserState.selectedLoopTypes]).toEqual(["inverted"]);
  });

  it("reroll mints a new seed, leaves dials untouched", () => {
    releaserState.selectedLoopTypes = new Set(["rotated"]);
    const before = releaserState.seed;
    releaserState.reroll();
    expect(releaserState.seed).not.toEqual(before);
    expect([...releaserState.selectedLoopTypes]).toEqual(["rotated"]);
  });
});
