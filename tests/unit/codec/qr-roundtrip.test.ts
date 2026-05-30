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

describe("Task 6: inline QR round-trip through the v2 codec", () => {
  it("encodeSequenceForQR -> decodeSequenceFromQR preserves derived endOrientation", async () => {
    const blue = __test__.encodeMotion(motion({ motionType: MotionType.ANTI, turns: 0, endOrientation: Orientation.OUT }), 1);
    const red = __test__.encodeMotion(motion({ motionType: MotionType.PRO, turns: 0, endOrientation: Orientation.IN }), 1);
    const original = decodeSequence(`${blue}:${red}|${blue}:${red}`);

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
