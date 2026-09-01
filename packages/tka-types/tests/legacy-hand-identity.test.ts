import { describe, expect, it } from "vitest";
import {
  normalizeLegacyHandPair,
  normalizeLegacyHandSide,
  normalizeLegacySequence,
  normalizeLegacyStep,
  normalizeLegacySteps,
} from "../src/legacy-hand-identity.js";

describe("legacy hand identity normalization", () => {
  it("preserves canonical hand-pair object identity", () => {
    const canonical = { left: { turns: 1 }, right: { turns: 2 } };

    expect(normalizeLegacyHandPair(canonical)).toBe(canonical);
  });

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
    const source = [
      { motions: { blue: { color: "blue" }, red: { color: "red" } } },
    ];
    const normalized = normalizeLegacySteps(source) as Array<
      Record<string, any>
    >;

    expect(normalized[0]?.motions.left.hand).toBe("left");
    expect(source[0]?.motions.blue.color).toBe("blue");
  });

  it("normalizes persisted sequence composition and prop intent", () => {
    const source = {
      blueSoloProp: { id: "blue-solo" },
      redSoloProp: { id: "red-solo" },
      bluePathHash: "blue-path",
      redPathHash: "red-path",
      blueSoloHash: "blue-solo-hash",
      redSoloHash: "red-solo-hash",
      stepPairings: [{ blueReversal: true, redReversal: false }],
      intendedProp: { bluePropType: "staff", redPropType: "fan" },
      creatorIntent: {
        propConfig: { bluePropType: "club", redPropType: "poi" },
      },
      loopSpec: {
        blue: { rotated: { period: 4 } },
        red: { mirrored: { period: 2 } },
      },
    };

    const normalized = normalizeLegacySequence(source) as Record<string, any>;

    expect(normalized).toMatchObject({
      leftSoloProp: { id: "blue-solo" },
      rightSoloProp: { id: "red-solo" },
      leftPathHash: "blue-path",
      rightPathHash: "red-path",
      leftSoloHash: "blue-solo-hash",
      rightSoloHash: "red-solo-hash",
      stepPairings: [{ leftReversal: true, rightReversal: false }],
      intendedProp: { leftPropType: "staff", rightPropType: "fan" },
      creatorIntent: {
        propConfig: { leftPropType: "club", rightPropType: "poi" },
      },
      loopSpec: {
        left: { rotated: { period: 4 } },
        right: { mirrored: { period: 2 } },
      },
    });
    expect(normalized).not.toHaveProperty("blueSoloProp");
    expect(normalized).not.toHaveProperty("redSoloProp");
    expect(source.blueSoloProp.id).toBe("blue-solo");
  });
});
