import { describe, expect, it } from "vitest";
import {
  nearestQuarterTurn,
  timingFromPhases,
} from "../../../src/lib/features/learn/components/interactive/motions/timing-intro-phase";

describe("timing circle interactions", () => {
  it("classifies the relationship regardless of which marker moved", () => {
    for (let left = -8; left <= 8; left++) {
      expect(timingFromPhases(left, left + 4)).toBe("together");
      expect(timingFromPhases(left, left + 2)).toBe("split");
      expect(timingFromPhases(left, left + 1)).toBe("quarter");
      expect(timingFromPhases(left, left - 1)).toBe("quarter");
    }
  });
  it("crosses the phase seam on the short arc", () => {
    expect(nearestQuarterTurn(3, 0)).toBe(4);
    expect(nearestQuarterTurn(0, 3)).toBe(-1);
    expect(nearestQuarterTurn(-1, 0)).toBe(0);
    expect(nearestQuarterTurn(8, 8)).toBe(8);
  });
});
