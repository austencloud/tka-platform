import { describe, it, expect } from "vitest";
import {
  nextColumnValue,
  prevColumnValue,
} from "../../../src/lib/shared/sequence-viewer/components/bento/columns-stepper";

describe("columns stepper", () => {
  it("nextColumnValue cycles Auto -> 2 -> 3 -> stepCount -> Auto", () => {
    expect(nextColumnValue(null, 4)).toBe(2);
    expect(nextColumnValue(2, 4)).toBe(3);
    expect(nextColumnValue(3, 4)).toBe(4);
    expect(nextColumnValue(4, 4)).toBe(null);
    expect(nextColumnValue(null, 4)).toBe(2);
  });

  it("prevColumnValue cycles Auto -> stepCount -> ... -> 2 -> Auto", () => {
    expect(prevColumnValue(null, 4)).toBe(4);
    expect(prevColumnValue(4, 4)).toBe(3);
    expect(prevColumnValue(3, 4)).toBe(2);
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
