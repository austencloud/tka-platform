import { describe, expect, it } from "vitest";
import {
  normalizeLegacyHandSide,
  normalizeLegacyStep,
  normalizeLegacySteps,
} from "../src/legacy-hand-identity.js";

describe("legacy hand identity normalization", () => {
  it("maps canonical palette names to performer-relative hands", () => {
    expect(normalizeLegacyHandSide("blue")).toBe("left");
    expect(normalizeLegacyHandSide("red")).toBe("right");
    expect(normalizeLegacyHandSide("left")).toBe("left");
    expect(normalizeLegacyHandSide("right")).toBe("right");
  });

  it("removes legacy keys while retaining unrelated motion metadata", () => {
    const normalized = normalizeLegacyStep({
      id: "legacy-step",
      blueReversal: true,
      redReversal: false,
      motions: {
        blue: { color: "blue", motionType: "pro", custom: 7 },
        red: { color: "red", motionType: "anti", custom: 9 },
      },
    }) as Record<string, any>;

    expect(normalized).toMatchObject({
      id: "legacy-step",
      leftReversal: true,
      rightReversal: false,
      motions: {
        left: { hand: "left", motionType: "pro", custom: 7 },
        right: { hand: "right", motionType: "anti", custom: 9 },
      },
    });
    expect(normalized).not.toHaveProperty("blueReversal");
    expect(normalized).not.toHaveProperty("redReversal");
    expect(normalized.motions).not.toHaveProperty("blue");
    expect(normalized.motions).not.toHaveProperty("red");
    expect(normalized.motions.left).not.toHaveProperty("color");
    expect(normalized.motions.right).not.toHaveProperty("color");
  });

  it("normalizes arrays without mutating their legacy source", () => {
    const source = [{ motions: { blue: { color: "blue" }, red: { color: "red" } } }];
    const normalized = normalizeLegacySteps(source) as Array<Record<string, any>>;

    expect(normalized[0]?.motions.left.hand).toBe("left");
    expect(source[0]?.motions.blue.color).toBe("blue");
  });
});
