import { describe, expect, it } from "vitest";
import { allocationSource, patternSource } from "./TurnSource.js";

describe("TurnSource", () => {
  it("reports no turn past the end of a random allocation", () => {
    // Today's behaviour, preserved: eager allocation is length-bound, so a
    // sequence longer than its allocation has steps with no turn at all.
    const source = allocationSource({ blue: [1, 2], red: [0, 0.5] });
    expect(source.at(0, "blue")).toBe(1);
    expect(source.at(2, "blue")).toBeUndefined();
  });

  it("resolves at every index, however far out, when driven by a pattern", () => {
    // A period has no length. This is what lets a pattern cover bridge steps.
    const source = patternSource({ blue: [0, 1.5], red: [0.5] });
    expect(source.at(0, "blue")).toBe(0);
    expect(source.at(1, "blue")).toBe(1.5);
    expect(source.at(2, "blue")).toBe(0);
    expect(source.at(97, "blue")).toBe(1.5);
    expect(source.at(97, "red")).toBe(0.5);
  });

  it("treats an empty lane as no turn rather than dividing by zero", () => {
    const source = patternSource({ blue: [], red: [] });
    expect(source.at(0, "blue")).toBeUndefined();
  });
});
