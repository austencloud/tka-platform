import { describe, it, expect } from "vitest";
import { createAnimatorState } from "$lib/shared/animation-engine/state/animator-state.svelte";

describe("AnimatorState", () => {
  it("exposes defaults and is independent per instance", () => {
    const a = createAnimatorState();
    const b = createAnimatorState();

    expect(a.isInitialized).toBe(false);
    expect(a.currentBluePropType).toBe("staff");
    expect(a.displayedTurnsTuple).toBe("(s, 0, 0)");

    a.setInitialized(true);
    a.setBluePropType("fan");

    expect(a.isInitialized).toBe(true);
    expect(a.currentBluePropType).toBe("fan");
    expect(b.isInitialized).toBe(false);
    expect(b.currentBluePropType).toBe("staff");
  });

  it("keeps the object-dimension reference stable on an equal-value set", () => {
    const s = createAnimatorState();
    const before = s.bluePropDimensions;
    s.setBluePropDimensions({ ...before }); // new ref, equal w/h
    expect(s.bluePropDimensions).toBe(before); // guard suppressed the reassignment
  });
});
