import { describe, it, expect } from "vitest";
import { parseTurnPattern, TURN_VALUES } from "../turn-pattern-parser";

describe("parseTurnPattern", () => {
  it("parses symmetric uniform-Nt format", () => {
    expect(parseTurnPattern("uniform-0t")).toEqual({ blue: 0, red: 0 });
    expect(parseTurnPattern("uniform-2t")).toEqual({ blue: 2, red: 2 });
    expect(parseTurnPattern("uniform 1.5t")).toEqual({ blue: 1.5, red: 1.5 });
  });

  it("parses asymmetric pipe-separated format", () => {
    expect(parseTurnPattern("0.5|1")).toEqual({ blue: 0.5, red: 1 });
    expect(parseTurnPattern("3|0")).toEqual({ blue: 3, red: 0 });
    expect(parseTurnPattern("1.5|2.5")).toEqual({ blue: 1.5, red: 2.5 });
  });

  it("returns null for unparseable patterns", () => {
    expect(parseTurnPattern("")).toBeNull();
    expect(parseTurnPattern("continuous")).toBeNull();
  });

  it("exports TURN_VALUES as [0, 0.5, 1, 1.5, 2, 2.5, 3]", () => {
    expect(TURN_VALUES).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3]);
  });
});
