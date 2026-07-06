import { describe, it, expect } from "vitest";
import { stepToIndexProgress } from "./tunnel-fold-math";

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
