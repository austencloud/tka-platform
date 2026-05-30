import { describe, it, expect } from "vitest";
import {
  __test__,
  decodeSequence,
  encodeSequenceForQR,
  decodeSequenceFromQR,
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

describe("Task 6: inline QR round-trip through the versioned codec", () => {
  it("encodeSequenceForQR -> decodeSequenceFromQR preserves derived endOrientation", async () => {
    // Consistent chain: STATIC start position (in/in), then one step.
    const spBlue = __test__.encodeMotion(motion({ motionType: MotionType.STATIC, startLocation: GridLocation.NORTH, endLocation: GridLocation.NORTH, startOrientation: Orientation.IN, endOrientation: Orientation.IN }), 1);
    const spRed = __test__.encodeMotion(motion({ motionType: MotionType.STATIC, startLocation: GridLocation.SOUTH, endLocation: GridLocation.SOUTH, startOrientation: Orientation.IN, endOrientation: Orientation.IN }), 1);
    const s1Blue = __test__.encodeMotion(motion({ motionType: MotionType.ANTI, turns: 0, startLocation: GridLocation.NORTH, endLocation: GridLocation.EAST, startOrientation: Orientation.IN, endOrientation: Orientation.OUT }), 1);
    const s1Red = __test__.encodeMotion(motion({ motionType: MotionType.PRO, turns: 0, startLocation: GridLocation.SOUTH, endLocation: GridLocation.WEST, startOrientation: Orientation.IN, endOrientation: Orientation.IN }), 1);
    const original = decodeSequence(`${spBlue}:${spRed}|${s1Blue}:${s1Red}`);

    const qr = await encodeSequenceForQR(original); // s~... (v2 inline)
    expect(qr.startsWith("s~")).toBe(true);

    const back = await decodeSequenceFromQR(qr);
    expect(back.steps.length).toBe(original.steps.length);
    for (let i = 0; i < original.steps.length; i++) {
      for (const c of ["blue", "red"] as const) {
        const o = original.steps[i]!.motions[c];
        const d = back.steps[i]!.motions[c];
        if (!o) {
          expect(d).toBeFalsy();
          continue;
        }
        expect(d!.endOrientation, `step ${i} ${c}`).toBe(o.endOrientation);
      }
    }
  });
});
