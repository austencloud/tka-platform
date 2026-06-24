import { describe, it, expect } from "vitest";
import { deriveTnDRatio } from "$lib/features/choreo-card/components/card-back/card-back-data";

/** Helper: one motion per step, both hands have the given turns */
function makeUniform(turnValue: number, stepCount: number = 3) {
  return {
    steps: Array.from({ length: stepCount }, () => ({
      motions: {
        blue: { turns: turnValue, motionType: "pro", rotationDirection: "cw" },
        red: { turns: turnValue, motionType: "anti", rotationDirection: "ccw" },
      },
    })),
  } as any;
}

/** Helper: each step gets a different turn value (simulates LOOP sequences) */
function makeMixed(turnValues: number[]) {
  return {
    steps: turnValues.map((t) => ({
      motions: {
        blue: { turns: t, motionType: "pro", rotationDirection: "cw" },
        red: { turns: t, motionType: "anti", rotationDirection: "ccw" },
      },
    })),
  } as any;
}

describe("deriveTnDRatio", () => {
  it("returns 1:1 for uniform 0 turns", () => {
    expect(deriveTnDRatio(makeUniform(0))).toBe("1:1");
  });

  it("returns 3:1 for uniform 1 turn", () => {
    expect(deriveTnDRatio(makeUniform(1))).toBe("3:1");
  });

  it("returns 5:1 for uniform 2 turns", () => {
    expect(deriveTnDRatio(makeUniform(2))).toBe("5:1");
  });

  it("returns 2:1 for uniform 0.5 turns", () => {
    expect(deriveTnDRatio(makeUniform(0.5))).toBe("2:1");
  });

  it("returns null for mixed turn values (typical LOOP)", () => {
    expect(deriveTnDRatio(makeMixed([0, 1, 0.5, 2]))).toBeNull();
  });

  it("returns null when blue and red hands differ", () => {
    const seq = {
      steps: [{
        motions: {
          blue: { turns: 1, motionType: "pro", rotationDirection: "cw" },
          red: { turns: 0.5, motionType: "anti", rotationDirection: "ccw" },
        },
      }],
    } as any;
    expect(deriveTnDRatio(seq)).toBeNull();
  });

  it("returns 1:1 for sequences with no steps", () => {
    expect(deriveTnDRatio({ steps: [] } as any)).toBe("1:1");
  });

  it("returns null for unrecognized uniform turn values", () => {
    expect(deriveTnDRatio(makeUniform(0.7))).toBeNull();
  });

  it("ignores float turns (fl string) and checks remaining", () => {
    const seq = {
      steps: [
        {
          motions: {
            blue: { turns: "fl", motionType: "float" },
            red: { turns: 1, motionType: "pro", rotationDirection: "cw" },
          },
        },
        {
          motions: {
            blue: { turns: 1, motionType: "pro", rotationDirection: "cw" },
            red: { turns: 1, motionType: "anti", rotationDirection: "ccw" },
          },
        },
      ],
    } as any;
    expect(deriveTnDRatio(seq)).toBe("3:1");
  });
});
