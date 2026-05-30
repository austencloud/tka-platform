import { describe, it, expect } from "vitest";
import { computeCardFrontLayout } from "$lib/shared/render/services/card-front-assembler";

describe("computeCardFrontLayout", () => {
  it("derives deckCard geometry from contentWidth/Height", () => {
    const seq = { steps: [{ letter: "A" }, { letter: "B" }] } as any;
    const layout = computeCardFrontLayout(
      seq,
      {
        deckCard: { contentWidth: 750, contentHeight: 1050 },
        includeStartPosition: true,
        addWord: true,
      },
      { showTKA: true } as any
    );
    expect(layout.canvasWidth).toBe(750);
    expect(layout.canvasHeight).toBe(1050);
    expect(layout.columns).toBeGreaterThan(0);
    expect(layout.stepSize).toBeGreaterThan(0);
  });
});
