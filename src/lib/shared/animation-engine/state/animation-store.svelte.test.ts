import { describe, it, expect } from "vitest";
import { createAnimationStore } from "./animation-store.svelte";

describe("AnimationStore", () => {
  it("exposes defaults and is independent per instance", () => {
    const a = createAnimationStore();
    const b = createAnimationStore();

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

  it("only mutates on real changes (referential no-op guard)", () => {
    const s = createAnimationStore();
    const before = s.bluePropDimensions;
    s.setBluePropDimensions(before); // same ref
    expect(s.bluePropDimensions).toBe(before);
  });
});
