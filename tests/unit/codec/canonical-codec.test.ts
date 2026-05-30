import { describe, it, expect } from "vitest";
import { __test__ } from "$lib/shared/navigation/services/sequence-encoder";
import {
  MotionType, RotationDirection, Orientation,
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

describe("encodeMotion canonical format", () => {
  it("non-float motion = startLoc(2)+endLoc(2)+rot(1)+turns(1), no type char", () => {
    // n=no, e=ea, cw=c, turns=0  ->  "noeac0"
    expect(__test__.encodeMotion(motion())).toBe("noeac0");
  });
  it("float = rotation x + appended prefloat rotation char", () => {
    // float n->e, prefloat pro on cw arc => prefloatRotationDirection cw => "c"
    // encoded: no ea x f c
    const m = motion({
      motionType: MotionType.FLOAT,
      turns: "fl",
      rotationDirection: RotationDirection.NO_ROTATION,
      prefloatRotationDirection: RotationDirection.CLOCKWISE,
    });
    expect(__test__.encodeMotion(m)).toBe("noeaxfc");
  });
});

describe("decodeMotion derivation", () => {
  it("derives pro/anti from rotation + locations", () => {
    const m = __test__.decodeMotion("noeac0", "blue", Orientation.IN, PropType.STAFF);
    expect(m?.motionType).toBe(MotionType.PRO);
    expect(m?.startOrientation).toBe(Orientation.IN);
    expect(m?.propType).toBe(PropType.STAFF);
  });
  it("derives float + prefloat rotation from the appended char", () => {
    const m = __test__.decodeMotion("noeaxfc", "blue", Orientation.IN, PropType.STAFF);
    expect(m?.motionType).toBe(MotionType.FLOAT);
    expect(m?.rotationDirection).toBe(RotationDirection.NO_ROTATION);
    expect(m?.prefloatRotationDirection).toBe(RotationDirection.CLOCKWISE);
    expect(m?.prefloatMotionType).toBe(MotionType.PRO);
  });
});
