import { describe, expect, it } from "vitest";
import {
  createMotion,
  updateMotion,
  MotionType,
  RotationDirection,
  Orientation,
  GridLocation,
  Plane,
  HandSide,
  type Motion,
} from "../src/index.js";

function baseBlueShift(): Motion {
  return createMotion({
    motionType: MotionType.shift,
    startLocation: GridLocation.n,
    endLocation: GridLocation.e,
    rotationDirection: RotationDirection.cw,
    startOrientation: Orientation.in,
    endOrientation: Orientation.out,
    turns: 0,
    plane: Plane.wall,
    hand: HandSide.LEFT,
  });
}

describe("createMotion", () => {
  it("constructs a Motion with required fields intact", () => {
    const m = baseBlueShift();
    expect(m.motionType).toBe("shift");
    expect(m.hand).toBe("left");
    expect(m.plane).toBe("wall");
    expect(m.turns).toBe(0);
  });

  it("freezes the returned object", () => {
    const m = baseBlueShift();
    expect(Object.isFrozen(m)).toBe(true);
  });

  it("accepts 'fl' as the turns value for float motions", () => {
    const m = createMotion({
      motionType: MotionType.float,
      startLocation: GridLocation.n,
      endLocation: GridLocation.e,
      rotationDirection: RotationDirection.cw,
      startOrientation: Orientation.in,
      endOrientation: Orientation.out,
      turns: "fl",
      plane: Plane.wall,
      hand: HandSide.LEFT,
      prefloatMotionType: MotionType.pro,
      prefloatRotationDirection: RotationDirection.cw,
    });
    expect(m.turns).toBe("fl");
    expect(m.prefloatMotionType).toBe("pro");
  });

  it("rejects invalid motionType", () => {
    expect(() =>
      createMotion({
        motionType: "bogus" as unknown as typeof MotionType.shift,
        startLocation: GridLocation.n,
        endLocation: GridLocation.e,
        rotationDirection: RotationDirection.cw,
        startOrientation: Orientation.in,
        endOrientation: Orientation.out,
        turns: 0,
        plane: Plane.wall,
        hand: HandSide.LEFT,
      })
    ).toThrow(/motionType/);
  });

  it("rejects invalid rotationDirection", () => {
    expect(() =>
      createMotion({
        motionType: MotionType.shift,
        startLocation: GridLocation.n,
        endLocation: GridLocation.e,
        rotationDirection: "spinny" as unknown as typeof RotationDirection.cw,
        startOrientation: Orientation.in,
        endOrientation: Orientation.out,
        turns: 0,
        plane: Plane.wall,
        hand: HandSide.LEFT,
      })
    ).toThrow(/rotationDirection/);
  });

  it("rejects non-finite turns", () => {
    expect(() =>
      createMotion({
        motionType: MotionType.shift,
        startLocation: GridLocation.n,
        endLocation: GridLocation.e,
        rotationDirection: RotationDirection.cw,
        startOrientation: Orientation.in,
        endOrientation: Orientation.out,
        turns: Number.NaN,
        plane: Plane.wall,
        hand: HandSide.LEFT,
      })
    ).toThrow(/turns/);
  });

  it("rejects invalid prefloatMotionType", () => {
    expect(() =>
      createMotion({
        motionType: MotionType.float,
        startLocation: GridLocation.n,
        endLocation: GridLocation.e,
        rotationDirection: RotationDirection.cw,
        startOrientation: Orientation.in,
        endOrientation: Orientation.out,
        turns: "fl",
        plane: Plane.wall,
        hand: HandSide.LEFT,
        prefloatMotionType: "twirl" as unknown as typeof MotionType.pro,
      })
    ).toThrow(/prefloatMotionType/);
  });
});

describe("createMotion defaults and optional fields", () => {
  it("defaults plane to 'wall' when omitted", () => {
    const m = createMotion({
      motionType: MotionType.shift,
      startLocation: GridLocation.n,
      endLocation: GridLocation.e,
      rotationDirection: RotationDirection.cw,
      startOrientation: Orientation.in,
      endOrientation: Orientation.out,
      turns: 0,
      hand: HandSide.LEFT,
    });
    expect(m.plane).toBe("wall");
  });

  it("accepts a Motion with no hand (keyed-channel case)", () => {
    const m = createMotion({
      motionType: MotionType.shift,
      startLocation: GridLocation.n,
      endLocation: GridLocation.e,
      rotationDirection: RotationDirection.cw,
      startOrientation: Orientation.in,
      endOrientation: Orientation.out,
      turns: 0,
      plane: Plane.wall,
    });
    expect(m.hand).toBeUndefined();
  });
});

describe("updateMotion", () => {
  it("returns a new frozen Motion with changes applied", () => {
    const base = baseBlueShift();
    const updated = updateMotion(base, { turns: 1 });
    expect(updated.turns).toBe(1);
    expect(updated).not.toBe(base);
    expect(Object.isFrozen(updated)).toBe(true);
    expect(base.turns).toBe(0); // original untouched
  });

  it("validates changes against enum membership", () => {
    const base = baseBlueShift();
    expect(() =>
      updateMotion(base, {
        plane: "diagonal" as unknown as typeof Plane.wall,
      })
    ).toThrow(/plane/);
  });
});
