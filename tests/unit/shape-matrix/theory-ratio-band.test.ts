import { describe, expect, it } from "vitest";

import { makeSpinRatio, spinRatioKey } from "@vtg/domain";
import {
  clampTheoryRatioToBand,
  THEORY_BANDS,
  theoryRatiosForBand,
  tkaNamesTheoryRatio,
} from "$lib/shared/shape-matrix/domain/theory-ratio-band";

/*
 * The boundary the Theory surface has to tell the truth about.
 *
 * TKA turns are quantized while the Theory field is continuous. These tests
 * keep the two vocabularies separate and pin the editor's complete 0–15 field.
 */
describe("theory ratio bands", () => {
  it("recognizes the exact quarter-turn ratio set across the wider field", () => {
    const named = theoryRatiosForBand(5)
      .filter(tkaNamesTheoryRatio)
      .map(spinRatioKey);

    expect(named).toEqual([
      "0:1",
      "1:2",
      "1:1",
      "3:2",
      "2:1",
      "5:2",
      "3:1",
      "7:2",
      "4:1",
      "9:2",
      "5:1",
      "11:2",
      "6:1",
      "13:2",
      "7:1",
    ]);
    expect(tkaNamesTheoryRatio(makeSpinRatio(1, 3))).toBe(false);
    expect(tkaNamesTheoryRatio(makeSpinRatio(15, 1))).toBe(false);
  });

  it("widens monotonically and keeps every narrower band's ratios", () => {
    for (let i = 1; i < THEORY_BANDS.length; i += 1) {
      const narrower = theoryRatiosForBand(THEORY_BANDS[i - 1]!).map(
        spinRatioKey
      );
      const wider = new Set(
        theoryRatiosForBand(THEORY_BANDS[i]!).map(spinRatioKey)
      );
      expect(wider.size).toBeGreaterThan(narrower.length);
      for (const key of narrower) expect(wider.has(key)).toBe(true);
    }
  });

  it("moves a ratio to its nearest neighbour when the band narrows", () => {
    const twoNinths = theoryRatiosForBand(4).find(
      (ratio) => spinRatioKey(ratio) === "2:9"
    )!;
    // 2/9 ≈ 0.222 sits nearer Float's 0 than the 1:2 reduction's 0.5, so
    // narrowing lands there rather than on the surface's default.
    expect(spinRatioKey(clampTheoryRatioToBand(twoNinths, 1))).toBe("0:1");
    expect(spinRatioKey(clampTheoryRatioToBand(twoNinths, 2))).toBe("1:3");
    expect(spinRatioKey(clampTheoryRatioToBand(twoNinths, 4))).toBe("2:9");
  });

  it("keeps numerator and denominator independent through the 15 cap", () => {
    const widest = new Set(theoryRatiosForBand(5).map(spinRatioKey));
    expect(widest.has("15:1")).toBe(true);
    expect(widest.has("15:14")).toBe(true);
    expect(widest.has("14:15")).toBe(true);
    expect(theoryRatiosForBand(1).map(spinRatioKey)).toContain("15:2");
  });
});
