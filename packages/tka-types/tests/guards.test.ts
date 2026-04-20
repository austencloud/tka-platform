import { describe, expect, it } from "vitest";
import {
  createMotion,
  createStep,
  createStartStep,
  isMotion,
  isStep,
  GridLocation,
  GridPosition,
  Letter,
  MotionType,
  Orientation,
  Plane,
  PropColor,
  RotationDirection,
} from "../src/index.js";

function makeBlue() {
  return createMotion({
    motionType: MotionType.shift,
    startLocation: GridLocation.n,
    endLocation: GridLocation.e,
    rotationDirection: RotationDirection.cw,
    startOrientation: Orientation.in,
    endOrientation: Orientation.out,
    turns: 0,
    plane: Plane.wall,
    color: PropColor.blue,
  });
}

function makeRed() {
  return createMotion({
    motionType: MotionType.shift,
    startLocation: GridLocation.s,
    endLocation: GridLocation.w,
    rotationDirection: RotationDirection.cw,
    startOrientation: Orientation.in,
    endOrientation: Orientation.out,
    turns: 0,
    plane: Plane.wall,
    color: PropColor.red,
  });
}

describe("isMotion", () => {
  it("accepts a well-formed Motion", () => {
    expect(isMotion(makeBlue())).toBe(true);
  });

  it("accepts turns: 'fl' on float motions", () => {
    const float = createMotion({
      motionType: MotionType.float,
      startLocation: GridLocation.n,
      endLocation: GridLocation.e,
      rotationDirection: RotationDirection.cw,
      startOrientation: Orientation.in,
      endOrientation: Orientation.out,
      turns: "fl",
      plane: Plane.wall,
      color: PropColor.blue,
    });
    expect(isMotion(float)).toBe(true);
  });

  it("rejects null", () => {
    expect(isMotion(null)).toBe(false);
  });

  it("rejects undefined", () => {
    expect(isMotion(undefined)).toBe(false);
  });

  it("rejects a plain object missing required fields", () => {
    expect(isMotion({ motionType: "shift" })).toBe(false);
  });

  it("rejects an object with an invalid enum value", () => {
    const bad = { ...makeBlue(), motionType: "bogus" };
    expect(isMotion(bad)).toBe(false);
  });

  it("rejects an object with non-finite turns", () => {
    const bad = { ...makeBlue(), turns: Number.POSITIVE_INFINITY };
    expect(isMotion(bad)).toBe(false);
  });

  it("rejects an array", () => {
    expect(isMotion([])).toBe(false);
  });
});

describe("isStep", () => {
  it("accepts a well-formed Step", () => {
    const s = createStep({
      id: "step-1-A",
      letter: Letter.A,
      startPosition: GridPosition.alpha1,
      endPosition: GridPosition.alpha3,
      motions: { blue: makeBlue(), red: makeRed() },
      stepNumber: 1,
      duration: 1,
    });
    expect(isStep(s)).toBe(true);
  });

  it("accepts a start-position Step (letter null, stepNumber 0)", () => {
    const s = createStartStep(GridPosition.beta1);
    expect(isStep(s)).toBe(true);
  });

  it("rejects a Step whose motions.blue.color is 'red'", () => {
    const s = createStep({
      id: "step-1-A",
      letter: Letter.A,
      startPosition: GridPosition.alpha1,
      endPosition: GridPosition.alpha3,
      motions: { blue: makeBlue(), red: makeRed() },
      stepNumber: 1,
      duration: 1,
    });
    // Tamper with a clone (guards operate on untrusted input)
    const tampered = {
      ...s,
      motions: { blue: { ...s.motions.blue, color: "red" }, red: s.motions.red },
    };
    expect(isStep(tampered)).toBe(false);
  });

  it("rejects null", () => {
    expect(isStep(null)).toBe(false);
  });

  it("rejects a Step with empty id", () => {
    const candidate = {
      id: "",
      letter: "A",
      startPosition: "alpha1",
      endPosition: "alpha3",
      motions: { blue: makeBlue(), red: makeRed() },
      stepNumber: 1,
      duration: 1,
    };
    expect(isStep(candidate)).toBe(false);
  });

  it("rejects a Step with negative stepNumber", () => {
    const candidate = {
      id: "x",
      letter: "A",
      startPosition: "alpha1",
      endPosition: "alpha3",
      motions: { blue: makeBlue(), red: makeRed() },
      stepNumber: -1,
      duration: 1,
    };
    expect(isStep(candidate)).toBe(false);
  });

  it("rejects a Step with unknown gridMode", () => {
    const candidate = {
      id: "x",
      letter: "A",
      startPosition: "alpha1",
      endPosition: "alpha3",
      motions: { blue: makeBlue(), red: makeRed() },
      stepNumber: 1,
      duration: 1,
      gridMode: "hex",
    };
    expect(isStep(candidate)).toBe(false);
  });

  it("rejects a Step whose motions.red is not a Motion", () => {
    const candidate = {
      id: "x",
      letter: "A",
      startPosition: "alpha1",
      endPosition: "alpha3",
      motions: { blue: makeBlue(), red: { color: "red" } },
      stepNumber: 1,
      duration: 1,
    };
    expect(isStep(candidate)).toBe(false);
  });

  it("accepts a Step with startPosition = null (partial)", () => {
    const candidate = {
      id: "x",
      letter: "A",
      startPosition: null,
      endPosition: "alpha3",
      motions: { blue: makeBlue(), red: makeRed() },
      stepNumber: 1,
      duration: 1,
    };
    expect(isStep(candidate)).toBe(true);
  });
});
