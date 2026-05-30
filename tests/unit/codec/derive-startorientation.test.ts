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

function m(over: Record<string, unknown>) {
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

describe("Task: v3 encodeMotion drops startOrientation", () => {
  it("v3 is exactly one char shorter than v2 (the dropped startOrient char)", () => {
    const motion = m({});
    expect(__test__.encodeMotion(motion, 2).length - __test__.encodeMotion(motion, 3).length).toBe(1);
  });
  it("v3 is two chars shorter than v1 (no startOrient, no endOrient)", () => {
    const motion = m({});
    expect(__test__.encodeMotion(motion, 1).length - __test__.encodeMotion(motion, 3).length).toBe(2);
  });
});

describe("Task: v3 chains startOrientation from seed; derives both orientations", () => {
  // A 2-step sequence with a physically consistent chain (each startOri == the
  // previous endOri, per hand). Built as v1 (stored), then re-encoded v3
  // (drops both orientations) and decoded — must reproduce every orientation.
  function buildConsistentV1(): string {
    // start position: both hands static, in/in (the seed)
    const spBlue = __test__.encodeMotion(m({ motionType: MotionType.STATIC, startLocation: GridLocation.NORTH, endLocation: GridLocation.NORTH, startOrientation: Orientation.IN, endOrientation: Orientation.IN }), 1);
    const spRed = __test__.encodeMotion(m({ motionType: MotionType.STATIC, startLocation: GridLocation.SOUTH, endLocation: GridLocation.SOUTH, startOrientation: Orientation.IN, endOrientation: Orientation.IN }), 1);

    // step 1: blue pro 0 (in->in), red anti 0 (in->out)
    const s1Blue = __test__.encodeMotion(m({ motionType: MotionType.PRO, startLocation: GridLocation.NORTH, endLocation: GridLocation.EAST, startOrientation: Orientation.IN, endOrientation: Orientation.IN }), 1);
    const s1Red = __test__.encodeMotion(m({ motionType: MotionType.ANTI, startLocation: GridLocation.SOUTH, endLocation: GridLocation.WEST, startOrientation: Orientation.IN, endOrientation: Orientation.OUT }), 1);

    // step 2: blue pro 0 (in->in), red anti 0 (out->in)
    const s2Blue = __test__.encodeMotion(m({ motionType: MotionType.PRO, startLocation: GridLocation.EAST, endLocation: GridLocation.SOUTH, startOrientation: Orientation.IN, endOrientation: Orientation.IN }), 1);
    const s2Red = __test__.encodeMotion(m({ motionType: MotionType.ANTI, startLocation: GridLocation.WEST, endLocation: GridLocation.NORTH, startOrientation: Orientation.OUT, endOrientation: Orientation.IN }), 1);

    return `${spBlue}:${spRed}|${s1Blue}:${s1Red}|${s2Blue}:${s2Red}`;
  }

  it("v3 round-trip reproduces every startOrientation and endOrientation", () => {
    const original = decodeSequence(buildConsistentV1()); // v1 stored
    const v3 = encodeSequence(original);
    expect(v3.startsWith("v3|")).toBe(true);

    const derived = decodeSequence(v3);

    // start position orientations
    for (const c of ["blue", "red"] as const) {
      const o = original.startPosition!.motions[c];
      const d = derived.startPosition!.motions[c];
      expect(d!.startOrientation, `startPos ${c} startOri`).toBe(o!.startOrientation);
      expect(d!.endOrientation, `startPos ${c} endOri`).toBe(o!.endOrientation);
    }

    // step orientations
    expect(derived.steps.length).toBe(original.steps.length);
    for (let i = 0; i < original.steps.length; i++) {
      for (const c of ["blue", "red"] as const) {
        const o = original.steps[i]!.motions[c];
        const d = derived.steps[i]!.motions[c];
        expect(d!.startOrientation, `step ${i} ${c} startOri`).toBe(o!.startOrientation);
        expect(d!.endOrientation, `step ${i} ${c} endOri`).toBe(o!.endOrientation);
      }
    }
  });

  it("v3 seed carries a non-default (nonradial) start orientation", () => {
    // blue starts counter (nonradial); chain must preserve it as step-1 startOri.
    const spBlue = __test__.encodeMotion(m({ motionType: MotionType.STATIC, startLocation: GridLocation.NORTH, endLocation: GridLocation.NORTH, startOrientation: Orientation.COUNTER, endOrientation: Orientation.COUNTER }), 1);
    const spRed = __test__.encodeMotion(m({ motionType: MotionType.STATIC, startLocation: GridLocation.SOUTH, endLocation: GridLocation.SOUTH, startOrientation: Orientation.IN, endOrientation: Orientation.IN }), 1);
    const s1Blue = __test__.encodeMotion(m({ motionType: MotionType.PRO, startLocation: GridLocation.NORTH, endLocation: GridLocation.EAST, startOrientation: Orientation.COUNTER, endOrientation: Orientation.COUNTER }), 1);
    const s1Red = __test__.encodeMotion(m({ motionType: MotionType.PRO, startLocation: GridLocation.SOUTH, endLocation: GridLocation.WEST, startOrientation: Orientation.IN, endOrientation: Orientation.IN }), 1);

    const original = decodeSequence(`${spBlue}:${spRed}|${s1Blue}:${s1Red}`);
    const derived = decodeSequence(encodeSequence(original));

    expect(derived.startPosition!.motions.blue!.startOrientation).toBe(Orientation.COUNTER);
    expect(derived.steps[0]!.motions.blue!.startOrientation).toBe(Orientation.COUNTER);
    expect(derived.steps[0]!.motions.red!.startOrientation).toBe(Orientation.IN);
  });
});

describe("Task: v1 and v2 still decode after v3 lands (regression)", () => {
  it("legacy v1 un-prefixed string keeps stored orientations", () => {
    const blue = __test__.encodeMotion(m({ motionType: MotionType.ANTI, startOrientation: Orientation.IN, endOrientation: Orientation.OUT }), 1);
    const red = __test__.encodeMotion(m({ motionType: MotionType.PRO, startOrientation: Orientation.IN, endOrientation: Orientation.IN }), 1);
    const seq = decodeSequence(`${blue}:${red}|${blue}:${red}`);
    expect(seq.steps[0]!.motions.blue!.endOrientation).toBe(Orientation.OUT);
  });
  it("v2 string still decodes (per-motion startOri, derived endOri)", () => {
    const blue = __test__.encodeMotion(m({ motionType: MotionType.ANTI, startOrientation: Orientation.IN }), 2);
    const red = __test__.encodeMotion(m({ motionType: MotionType.PRO, startOrientation: Orientation.IN }), 2);
    const seq = decodeSequence(`v2|${blue}:${red}|${blue}:${red}`);
    expect(seq.steps[0]!.motions.blue!.startOrientation).toBe(Orientation.IN);
    expect(seq.steps[0]!.motions.blue!.endOrientation).toBe(Orientation.OUT); // anti 0 switches
  });
});
