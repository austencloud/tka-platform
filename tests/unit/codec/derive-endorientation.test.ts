import { describe, it, expect } from "vitest";
import {
  __test__,
  encodeSequence,
  decodeSequence,
} from "$lib/shared/navigation/services/sequence-encoder";
import {
  MotionType,
  RotationDirection,
  Orientation,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

function motion(over: Record<string, unknown> = {}) {
  return {
    motionType: MotionType.PRO,
    rotationDirection: RotationDirection.CLOCKWISE,
    startLocation: GridLocation.NORTH,
    endLocation: GridLocation.EAST,
    turns: 0,
    startOrientation: Orientation.IN,
    endOrientation: Orientation.IN,
    propType: PropType.STAFF,
    ...over,
  } as never;
}

// Whole-turn orientation algebra (rotationDirection irrelevant for integer turns):
//   pro  even -> preserve, pro  odd -> switch
//   anti even -> switch,   anti odd -> preserve
const CASES = [
  { name: "pro 0 preserves (in->in)", m: motion({ motionType: MotionType.PRO, turns: 0 }), expected: Orientation.IN },
  { name: "pro 1 switches (in->out)", m: motion({ motionType: MotionType.PRO, turns: 1 }), expected: Orientation.OUT },
  { name: "anti 0 switches (in->out)", m: motion({ motionType: MotionType.ANTI, turns: 0 }), expected: Orientation.OUT },
  { name: "anti 1 preserves (in->in)", m: motion({ motionType: MotionType.ANTI, turns: 1 }), expected: Orientation.IN },
];

describe("Task 1: encodeMotion versioning", () => {
  it("v2 is exactly one char shorter than v1 (the dropped endOrient char)", () => {
    const m = motion();
    const v1 = __test__.encodeMotion(m, 1);
    const v2 = __test__.encodeMotion(m, 2);
    expect(v1.length - v2.length).toBe(1);
  });
});

describe("Task 2: v2 decodeMotion derives endOrientation (hand-known algebra)", () => {
  for (const c of CASES) {
    it(c.name, () => {
      // v1: stored endOrientation read positionally, unchanged behavior.
      const v1 = __test__.encodeMotion(motion({ ...(c.m as object), endOrientation: c.expected }), 1);
      expect(__test__.decodeMotion(v1, "blue", 1)!.endOrientation).toBe(c.expected);

      // v2: no stored endOrientation; decoder must derive the same value.
      const v2 = __test__.encodeMotion(c.m, 2);
      expect(__test__.decodeMotion(v2, "blue", 2)!.endOrientation).toBe(c.expected);
    });
  }
});

describe("Task 3 + 4: sequence sentinel + derived==original equivalence", () => {
  it("encodeSequence emits v2| and v2 round-trip derives the original endOrientation", () => {
    // Build a v1 (un-prefixed) flat string carrying TRUE stored endOrientations.
    const blue = __test__.encodeMotion(motion({ motionType: MotionType.ANTI, turns: 0, endOrientation: Orientation.OUT }), 1);
    const red = __test__.encodeMotion(motion({ motionType: MotionType.PRO, turns: 0, endOrientation: Orientation.IN }), 1);
    const v1Flat = `${blue}:${red}|${blue}:${red}`; // startPos | step1

    const original = decodeSequence(v1Flat); // v1 path, stored endOri
    const v2Flat = encodeSequence(original); // drops endOri, adds sentinel
    expect(v2Flat.startsWith("v2|")).toBe(true);

    const derived = decodeSequence(v2Flat); // recomputes endOri
    expect(derived.steps.length).toBe(original.steps.length);
    for (let i = 0; i < original.steps.length; i++) {
      for (const c of ["blue", "red"] as const) {
        const o = original.steps[i]!.motions[c];
        const d = derived.steps[i]!.motions[c];
        if (!o) {
          expect(d).toBeFalsy();
          continue;
        }
        expect(d!.endOrientation, `step ${i} ${c}`).toBe(o.endOrientation);
      }
    }
  });
});

describe("Task 5: legacy v1 decode regression", () => {
  it("un-prefixed flat string decodes as v1 and keeps its stored endOrientation", () => {
    // anti 0 stored as OUT — v1 must read it positionally, not derive.
    const blue = __test__.encodeMotion(motion({ motionType: MotionType.ANTI, turns: 0, endOrientation: Orientation.OUT }), 1);
    const red = __test__.encodeMotion(motion({ motionType: MotionType.PRO, turns: 0, endOrientation: Orientation.IN }), 1);
    const v1Flat = `${blue}:${red}|${blue}:${red}`;
    const seq = decodeSequence(v1Flat);
    expect(seq.steps[0]!.motions.blue!.endOrientation).toBe(Orientation.OUT);
    expect(seq.steps[0]!.motions.red!.endOrientation).toBe(Orientation.IN);
  });
});
