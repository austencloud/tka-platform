import { describe, it, expect } from "vitest";
import { createStartHereState } from "./start-here-state.svelte";

describe("start-here-state", () => {
  it("starts on the decide step with no track", () => {
    const s = createStartHereState();
    expect(s.step).toBe("decide");
    expect(s.track).toBe(null);
  });

  it("base track goes decide -> base-families", () => {
    const s = createStartHereState();
    s.chooseBase();
    expect(s.track).toBe("base");
    expect(s.step).toBe("base-families");
  });

  it("selecting a family goes to base-cards and records the family", () => {
    const s = createStartHereState();
    s.chooseBase();
    s.selectFamily("split-same");
    expect(s.step).toBe("base-cards");
    expect(s.familyId).toBe("split-same");
  });

  it("loop track goes decide -> loop-types", () => {
    const s = createStartHereState();
    s.chooseLoop();
    expect(s.track).toBe("loop");
    expect(s.step).toBe("loop-types");
  });

  it("back from base-cards returns to base-families and clears the family", () => {
    const s = createStartHereState();
    s.chooseBase();
    s.selectFamily("split-same");
    s.back();
    expect(s.step).toBe("base-families");
    expect(s.familyId).toBe(null);
  });

  it("back from base-families returns to decide and clears the track", () => {
    const s = createStartHereState();
    s.chooseBase();
    s.back();
    expect(s.step).toBe("decide");
    expect(s.track).toBe(null);
  });

  it("browseAll sets the browse-all step", () => {
    const s = createStartHereState();
    s.browseAll();
    expect(s.step).toBe("browse-all");
  });
});
