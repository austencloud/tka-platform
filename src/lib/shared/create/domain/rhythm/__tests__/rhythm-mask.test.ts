import { describe, it, expect } from "vitest";
import {
  maskAt, activeAt, divisorsUpTo, uniformActive, allBase,
  tilePeriod, resizePeriod, perHandRhythmMatches, singleLaneRhythmMatches,
} from "../rhythm-mask";

describe("rhythm-mask", () => {
  it("maskAt decodes P/R/B/- and tiles", () => {
    expect(maskAt("RB", 0)).toEqual({ blue: false, red: true });
    expect(maskAt("RB", 1)).toEqual({ blue: true, red: false });
    expect(maskAt("P", 5)).toEqual({ blue: true, red: true });
    expect(maskAt("P-", 1)).toEqual({ blue: false, red: false });
  });
  it("activeAt is true for any non-dash", () => {
    expect(activeAt("P---", 0)).toBe(true);
    expect(activeAt("P---", 2)).toBe(false);
  });
  it("divisorsUpTo returns divisors capped at 8", () => {
    expect(divisorsUpTo(8)).toEqual([1, 2, 4, 8]);
    expect(divisorsUpTo(6)).toEqual([1, 2, 3, 6]);
    expect(divisorsUpTo(16)).toEqual([1, 2, 4, 8]);
  });
  it("uniformActive returns the shared non-base value or null", () => {
    expect(uniformActive([0, 1, 0, 1], 0)).toBe(1);
    expect(uniformActive([0, 1, 0, 2], 0)).toBeNull();
    expect(uniformActive([0, 0], 0)).toBeNull();
  });
  it("allBase detects an all-default array", () => {
    expect(allBase([0, 0], 0)).toBe(true);
    expect(allBase([0, 1], 0)).toBe(false);
  });
  it("tilePeriod and resizePeriod tile by modulo", () => {
    expect(tilePeriod([1, 0], 4)).toEqual([1, 0, 1, 0]);
    expect(resizePeriod([1, 0], 3, 0)).toEqual([1, 0, 1]);
    expect(resizePeriod([1], 2, 0)).toEqual([1, 1]);
  });
  it("perHandRhythmMatches recognises an Alternating strip", () => {
    expect(perHandRhythmMatches("RB", [0, 1], [1, 0], 0)).toBe(true);
    expect(perHandRhythmMatches("P", [0, 1], [1, 0], 0)).toBe(false);
  });
  it("perHandRhythmMatches is false for an all-zero strip", () => {
    expect(perHandRhythmMatches("P", [0, 0], [0, 0], 0)).toBe(false);
  });
  it("singleLaneRhythmMatches recognises a downbeat hold", () => {
    expect(singleLaneRhythmMatches("P---", [2, 1, 1, 1], 1)).toBe(true);
    expect(singleLaneRhythmMatches("P", [2, 1, 1, 1], 1)).toBe(false);
  });
});
