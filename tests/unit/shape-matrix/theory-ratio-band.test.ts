import { describe, expect, it } from "vitest";

import { spinRatioKey, spinRatioToTkaTurnFraction } from "@vtg/domain";
import {
  clampTheoryRatioToBand,
  THEORY_BANDS,
  theoryRatiosForBand,
  tkaNamesTheoryRatio,
} from "$lib/shared/shape-matrix/domain/theory-ratio-band";

/*
 * The boundary the Theory surface has to tell the truth about.
 *
 * TKA turns are quantized — the finest a level palette holds is a quarter turn
 * — while (P/Q − 1) / 2 answers every ratio. Those two facts are why a 4:9 has
 * an arithmetic value and no level, and why the surface may not present a band
 * as one. These tests pin the set that the level system actually reaches, so a
 * later change to the band ladder cannot quietly widen the claim.
 */
describe("theory ratio bands", () => {
  it("names exactly Float, 1:2 and isolation as the ratios TKA reaches", () => {
    expect(theoryRatiosForBand(1).map(spinRatioKey)).toEqual([
      "0:1",
      "1:2",
      "1:1",
    ]);

    for (const ratio of theoryRatiosForBand(1)) {
      expect(tkaNamesTheoryRatio(ratio)).toBe(true);
    }
  });

  it("leaves every wider ratio outside the level system", () => {
    const outside = theoryRatiosForBand(4).filter(
      (ratio) => !tkaNamesTheoryRatio(ratio)
    );
    expect(outside.length).toBeGreaterThan(0);

    for (const ratio of outside) {
      const fraction = spinRatioToTkaTurnFraction(ratio);
      // The arithmetic still answers. What it returns is never a turn any
      // level palette holds: a quarter turn is 1/4, and these are not
      // quarter multiples.
      if (fraction === null || fraction === "fl") continue;
      const quarters = (fraction.numerator * 4) / fraction.denominator;
      expect(Number.isInteger(quarters)).toBe(false);
    }
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
});
