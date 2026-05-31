import { describe, it, expect } from "vitest";
import { stripToTurnPattern, stripToDurationPattern } from "../pattern-strip-apply";

describe("pattern-strip-apply", () => {
  it("tiles a 2-beat turn strip across an 8-beat sequence", () => {
    const p = stripToTurnPattern([1, 0], [0, 1], 8);
    expect(p.stepCount).toBe(8);
    expect(p.entries).toHaveLength(8);
    expect(p.entries[0]).toEqual({ stepIndex: 0, blue: 1, red: 0 });
    expect(p.entries[1]).toEqual({ stepIndex: 1, blue: 0, red: 1 });
    expect(p.entries[2]).toEqual({ stepIndex: 2, blue: 1, red: 0 });
  });
  it("preserves float turn values", () => {
    const p = stripToTurnPattern(["fl"], [0], 2);
    expect(p.entries[0]!.blue).toBe("fl");
    expect(p.entries[1]!.blue).toBe("fl");
  });
  it("tiles a duration strip", () => {
    const p = stripToDurationPattern([2, 1], 4);
    expect(p.entries.map((e) => e.duration)).toEqual([2, 1, 2, 1]);
  });
});
