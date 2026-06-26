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

  it("derives non-deckCard canvas from columns x stepSize", () => {
    const seq = { steps: [{ letter: "A" }, { letter: "B" }, { letter: "C" }] } as any;
    const layout = computeCardFrontLayout(seq, { stepSize: 100 }, {} as any);
    expect(layout.canvasWidth).toBe(layout.columns * layout.stepSize);
    expect(layout.stepSize).toBe(100);
  });

  it("offsets the grid for a column-mode start position", () => {
    const seq = { steps: [{ letter: "A" }, { letter: "B" }], startPosition: {} } as any;
    const layout = computeCardFrontLayout(seq, { includeStartPosition: true, startPositionLayout: "column" }, {} as any);
    expect(layout.startColumn).toBe(1);
    expect(layout.stepsPerRow).toBe(layout.columns - 1);
  });

  // Regression: the download-card export dropped the LOOP/Header toggle, so a
  // looped sequence always drew the loop label + its header band even with the
  // header turned off in the preview. The contract: showLoopGlyph:false must
  // collapse the header band to zero height when word + difficulty are also off.
  it("draws the loop header band when showLoopGlyph is omitted (default-on)", () => {
    const seq = { steps: [{ letter: "A" }, { letter: "B" }], loopType: "rotated" } as any;
    const layout = computeCardFrontLayout(
      seq,
      { stepSize: 100, addWord: false, addDifficultyLevel: false },
      {} as any
    );
    expect(layout.headerHeight).toBeGreaterThan(0);
  });

  it("collapses the header band when the LOOP toggle is off and word/level are off", () => {
    const seq = { steps: [{ letter: "A" }, { letter: "B" }], loopType: "rotated" } as any;
    const layout = computeCardFrontLayout(
      seq,
      { stepSize: 100, addWord: false, addDifficultyLevel: false, showLoopGlyph: false },
      {} as any
    );
    expect(layout.headerHeight).toBe(0);
  });
});
