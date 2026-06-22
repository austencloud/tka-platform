import { describe, it, expect } from "vitest";
import {
  nextColumnValue,
  prevColumnValue,
  columnOptionsFor,
} from "../../../src/lib/shared/sequence-viewer/components/bento/columns-stepper";

describe("columnOptionsFor", () => {
  it("offers only divisors so every row is full (16 -> 2,4,8)", () => {
    expect(columnOptionsFor(16)).toEqual([2, 4, 8]);
  });

  it("4 steps offers only 2 and 4 (3 is not a divisor)", () => {
    expect(columnOptionsFor(4)).toEqual([2, 4]);
  });

  it("offers divisors within range for each beat count", () => {
    expect(columnOptionsFor(2)).toEqual([2]);
    expect(columnOptionsFor(3)).toEqual([3]);
    expect(columnOptionsFor(6)).toEqual([2, 3, 6]);
    expect(columnOptionsFor(12)).toEqual([2, 3, 4, 6]);
  });

  it("clamps to the 8-column ceiling (20 -> divisors <= 8)", () => {
    expect(columnOptionsFor(20)).toEqual([2, 4, 5]);
  });

  it("returns [] for prime counts with no divisor in range", () => {
    expect(columnOptionsFor(13)).toEqual([]);
    expect(columnOptionsFor(11)).toEqual([]);
  });

  it("returns no numeric options for stepCount < 2", () => {
    expect(columnOptionsFor(1)).toEqual([]);
    expect(columnOptionsFor(0)).toEqual([]);
  });
});

describe("columns stepper", () => {
  it("nextColumnValue cycles Auto -> 2 -> 4 -> Auto for 4 steps (skips 3)", () => {
    expect(nextColumnValue(null, 4)).toBe(2);
    expect(nextColumnValue(2, 4)).toBe(4);
    expect(nextColumnValue(4, 4)).toBe(null);
    expect(nextColumnValue(null, 4)).toBe(2);
  });

  it("prevColumnValue cycles Auto -> 4 -> 2 -> Auto for 4 steps (skips 3)", () => {
    expect(prevColumnValue(null, 4)).toBe(4);
    expect(prevColumnValue(4, 4)).toBe(2);
    expect(prevColumnValue(2, 4)).toBe(null);
  });

  it("clamps when stepCount is 2", () => {
    expect(nextColumnValue(null, 2)).toBe(2);
    expect(nextColumnValue(2, 2)).toBe(null);
    expect(prevColumnValue(null, 2)).toBe(2);
  });

  it("returns null for stepCount < 2 (only Auto makes sense)", () => {
    expect(nextColumnValue(null, 1)).toBe(null);
    expect(prevColumnValue(null, 1)).toBe(null);
  });

  it("clamps out-of-range current to null on next", () => {
    // User had columns=5 then loaded a 3-beat sequence. Next should go Auto.
    expect(nextColumnValue(5, 3)).toBe(null);
  });
});
