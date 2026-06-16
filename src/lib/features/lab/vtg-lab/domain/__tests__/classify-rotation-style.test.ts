import { describe, it, expect } from "vitest";
import { classifyRotationStyle } from "../classify-rotation-style";

// Minimal sequence shape: steps with blue/red motions carrying a motionType.
function seq(pairs: Array<[string, string]>): any {
  return {
    steps: pairs.map(([blue, red]) => ({
      isBlank: false,
      motions: { blue: { motionType: blue }, red: { motionType: red } },
    })),
  };
}

describe("classifyRotationStyle", () => {
  it("both pro → iso", () => {
    expect(classifyRotationStyle(seq([["static", "static"], ["pro", "pro"]]))).toBe("iso");
  });
  it("both anti → antispin", () => {
    expect(classifyRotationStyle(seq([["anti", "anti"]]))).toBe("antispin");
  });
  it("one pro one anti → hybrid", () => {
    expect(classifyRotationStyle(seq([["pro", "anti"]]))).toBe("hybrid");
  });
  it("uses prefloatMotionType when a hand floats", () => {
    const s = {
      steps: [{ isBlank: false, motions: { blue: { motionType: "float", prefloatMotionType: "anti" }, red: { motionType: "anti" } } }],
    } as any;
    expect(classifyRotationStyle(s)).toBe("antispin");
  });
  it("skips non-rotating (static/dash) steps; falls back to hybrid if none rotate", () => {
    expect(classifyRotationStyle(seq([["static", "static"], ["dash", "dash"]]))).toBe("hybrid");
  });
});
