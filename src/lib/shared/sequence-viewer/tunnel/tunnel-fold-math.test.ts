import { describe, it, expect } from "vitest";
import { rotAmountsFor, stepToIndexProgress } from "./tunnel-fold-math";

describe("rotAmountsFor", () => {
  it("2-fold = single 180° copy", () => expect(rotAmountsFor(2)).toEqual([4]));
  it("4-fold = 90/180/270", () => expect(rotAmountsFor(4)).toEqual([2, 4, 6]));
  it("8-fold = every 45°", () => expect(rotAmountsFor(8)).toEqual([1, 2, 3, 4, 5, 6, 7]));
});

describe("stepToIndexProgress", () => {
  it("maps 1-indexed currentStep to 0-indexed idx + fractional progress", () => {
    expect(stepToIndexProgress(1.0, 8)).toEqual({ idx: 0, progress: 0 });
    expect(stepToIndexProgress(3.5, 8)).toEqual({ idx: 2, progress: 0.5 });
  });
  it("clamps below 1 to the first step", () => {
    expect(stepToIndexProgress(0.4, 8)).toEqual({ idx: 0, progress: 0 });
  });
  it("clamps past the end to the last step", () => {
    expect(stepToIndexProgress(99, 8)).toEqual({ idx: 7, progress: 0 });
  });
  it("returns idx 0 / progress 0 for empty sequences", () => {
    expect(stepToIndexProgress(3, 0)).toEqual({ idx: 0, progress: 0 });
  });
});
