import { describe, it, expect } from "vitest";
import { buildHalvedStep } from "$lib/shared/animation-engine/services/build-halved-step";
import { calculateOrientationAt } from "$lib/shared/animation-engine/services/orientation-at";
import { createStepData } from "$lib/shared/foundation/domain/factories/create-step-data";
import {
  createMotionData,
  isVisibleMotion,
} from "$lib/shared/pictograph/shared/domain/models/motion-data";
import {
  MotionType,
  MotionColor,
  Orientation,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

describe("buildHalvedStep — real motion families", () => {
  it("PRO E->S, IN->IN, CW, 1 turn (red real, blue placeholder)", () => {
    const redMotion = createMotionData({
      color: MotionColor.RED,
      motionType: MotionType.PRO,
      startLocation: GridLocation.EAST,
      endLocation: GridLocation.SOUTH,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.IN,
      rotationDirection: RotationDirection.CLOCKWISE,
      turns: 1,
      isVisible: true,
    });
    const step = createStepData({ motions: { red: redMotion } });

    const result = buildHalvedStep(step);

    expect(result).not.toBeNull();
    expect(result!.motions.red.endLocation).toBe(GridLocation.SOUTHEAST);
    expect(result!.motions.red.segment).toEqual({ t0: 0, t1: 0.5 });

    // Derive the expectation from calculateOrientationAt itself — don't hardcode
    // the orientation value.
    const expectedOrientation = calculateOrientationAt(
      {
        motionType: MotionType.PRO,
        rotationDirection: RotationDirection.CLOCKWISE,
        startLocation: GridLocation.EAST,
        endLocation: GridLocation.SOUTH,
        startOrientation: Orientation.IN,
        endOrientation: Orientation.IN,
        turns: 1,
      },
      0.5,
      MotionColor.RED
    );
    expect(expectedOrientation).not.toBeNull();
    expect(result!.motions.red.endOrientation).toBe(expectedOrientation);
  });

  it("ANTI E->S, IN->OUT, CCW, 2 turns", () => {
    const redMotion = createMotionData({
      color: MotionColor.RED,
      motionType: MotionType.ANTI,
      startLocation: GridLocation.EAST,
      endLocation: GridLocation.SOUTH,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.OUT,
      rotationDirection: RotationDirection.COUNTER_CLOCKWISE,
      turns: 2,
      isVisible: true,
    });
    const step = createStepData({ motions: { red: redMotion } });

    const result = buildHalvedStep(step);

    expect(result).not.toBeNull();
    expect(result!.motions.red.endLocation).toBe(GridLocation.SOUTHEAST);
    expect(result!.motions.red.segment).toEqual({ t0: 0, t1: 0.5 });
  });

  it("DASH S->N, IN->OUT, CCW, 2 turns -> halfway location is CENTER", () => {
    const redMotion = createMotionData({
      color: MotionColor.RED,
      motionType: MotionType.DASH,
      startLocation: GridLocation.SOUTH,
      endLocation: GridLocation.NORTH,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.OUT,
      rotationDirection: RotationDirection.COUNTER_CLOCKWISE,
      turns: 2,
      isVisible: true,
    });
    const step = createStepData({ motions: { red: redMotion } });

    const result = buildHalvedStep(step);

    expect(result).not.toBeNull();
    expect(result!.motions.red.endLocation).toBe(GridLocation.CENTER);
    expect(result!.motions.red.segment).toEqual({ t0: 0, t1: 0.5 });
  });

  it("STATIC E->E, IN->IN, CCW, 2 turns -> halfway location is the (unchanged) start", () => {
    const redMotion = createMotionData({
      color: MotionColor.RED,
      motionType: MotionType.STATIC,
      startLocation: GridLocation.EAST,
      endLocation: GridLocation.EAST,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.IN,
      rotationDirection: RotationDirection.COUNTER_CLOCKWISE,
      turns: 2,
      isVisible: true,
    });
    const step = createStepData({ motions: { red: redMotion } });

    const result = buildHalvedStep(step);

    expect(result).not.toBeNull();
    expect(result!.motions.red.endLocation).toBe(GridLocation.EAST);
    expect(result!.motions.red.segment).toEqual({ t0: 0, t1: 0.5 });
  });

  it("blue-hand case: proves the hand's own MotionColor is passed to calculateOrientationAt (not a hardcoded RED)", () => {
    const blueMotion = createMotionData({
      color: MotionColor.BLUE,
      motionType: MotionType.ANTI,
      startLocation: GridLocation.NORTH,
      endLocation: GridLocation.EAST,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.OUT,
      rotationDirection: RotationDirection.CLOCKWISE,
      turns: 1,
      isVisible: true,
    });
    const step = createStepData({ motions: { blue: blueMotion } });

    const result = buildHalvedStep(step);

    expect(result).not.toBeNull();
    expect(result!.motions.blue.endOrientation).not.toBeNull();
    expect(result!.motions.blue.segment).toEqual({ t0: 0, t1: 0.5 });
  });
});

describe("buildHalvedStep — off-lattice and unsupported-motion guards", () => {
  it("returns null for an off-lattice quarter-turn motion (turns=0.25)", () => {
    const redMotion = createMotionData({
      color: MotionColor.RED,
      motionType: MotionType.PRO,
      startLocation: GridLocation.NORTH,
      endLocation: GridLocation.EAST,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.IN,
      rotationDirection: RotationDirection.CLOCKWISE,
      turns: 0.25,
      isVisible: true,
    });
    const step = createStepData({ motions: { red: redMotion } });

    expect(buildHalvedStep(step)).toBeNull();
  });

  it("returns null for a FLOAT motion (no float_half asset exists)", () => {
    const redMotion = createMotionData({
      color: MotionColor.RED,
      motionType: MotionType.FLOAT,
      startLocation: GridLocation.NORTH,
      endLocation: GridLocation.EAST,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.IN,
      rotationDirection: RotationDirection.CLOCKWISE,
      turns: 1,
      isVisible: true,
    });
    const step = createStepData({ motions: { red: redMotion } });

    expect(buildHalvedStep(step)).toBeNull();
  });

  it("returns null for a skewed motion (skewSteps set)", () => {
    const redMotion = createMotionData({
      color: MotionColor.RED,
      motionType: MotionType.PRO,
      startLocation: GridLocation.EAST,
      endLocation: GridLocation.SOUTH,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.IN,
      rotationDirection: RotationDirection.CLOCKWISE,
      turns: 1,
      isVisible: true,
      skewSteps: 1,
    });
    const step = createStepData({ motions: { red: redMotion } });

    expect(buildHalvedStep(step)).toBeNull();
  });

  it("returns null for a shift whose start/end aren't a single 45deg-adjacent hop (unknown pair)", () => {
    const redMotion = createMotionData({
      color: MotionColor.RED,
      motionType: MotionType.PRO,
      startLocation: GridLocation.NORTH,
      endLocation: GridLocation.SOUTH, // opposite cardinal — not a single arc segment
      startOrientation: Orientation.IN,
      endOrientation: Orientation.IN,
      rotationDirection: RotationDirection.CLOCKWISE,
      turns: 1,
      isVisible: true,
    });
    const step = createStepData({ motions: { red: redMotion } });

    expect(buildHalvedStep(step)).toBeNull();
  });

  it("returns null for t !== 0.5 (v1 is midpoint-only)", () => {
    const redMotion = createMotionData({
      color: MotionColor.RED,
      motionType: MotionType.PRO,
      startLocation: GridLocation.EAST,
      endLocation: GridLocation.SOUTH,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.IN,
      rotationDirection: RotationDirection.CLOCKWISE,
      turns: 1,
      isVisible: true,
    });
    const step = createStepData({ motions: { red: redMotion } });

    expect(buildHalvedStep(step, 0.25)).toBeNull();
  });

  it("carries a placeholder hand through unchanged", () => {
    const redMotion = createMotionData({
      color: MotionColor.RED,
      motionType: MotionType.PRO,
      startLocation: GridLocation.EAST,
      endLocation: GridLocation.SOUTH,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.IN,
      rotationDirection: RotationDirection.CLOCKWISE,
      turns: 1,
      isVisible: true,
    });
    const step = createStepData({ motions: { red: redMotion } });

    // createStepData fills the omitted blue hand with an invisible placeholder.
    expect(isVisibleMotion(step.motions.blue)).toBe(false);

    const result = buildHalvedStep(step);

    expect(result).not.toBeNull();
    expect(result!.motions.blue).toBe(step.motions.blue);
    expect(isVisibleMotion(result!.motions.blue)).toBe(false);
  });
});
