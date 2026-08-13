import { describe, expect, it } from "vitest";
import { LOOPComponent } from "@tka/sequence-engine/loop";
import {
  GridLocation,
  GridMode,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  MotionColor,
  MotionType,
  Orientation,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import {
  generateRewoundSoloLoopFromMotions,
  generateStructuredSoloLoopFromMotions,
} from "$lib/features/fuse/services/solo-loop-generator";

const templates = [
  createMotionData({
    color: MotionColor.BLUE,
    gridMode: GridMode.DIAMOND,
    motionType: MotionType.PRO,
    rotationDirection: RotationDirection.CLOCKWISE,
    startLocation: GridLocation.NORTH,
    endLocation: GridLocation.EAST,
    startOrientation: Orientation.IN,
    endOrientation: Orientation.OUT,
    turns: 1,
  }),
  createMotionData({
    color: MotionColor.RED,
    gridMode: GridMode.DIAMOND,
    motionType: MotionType.ANTI,
    rotationDirection: RotationDirection.COUNTER_CLOCKWISE,
    startLocation: GridLocation.EAST,
    endLocation: GridLocation.SOUTH,
    startOrientation: Orientation.IN,
    endOrientation: Orientation.IN,
    turns: 0,
  }),
];

describe("Fuse solo LOOP generator", () => {
  it("creates an exact-length loop without any paired sequence input", () => {
    const generated = generateRewoundSoloLoopFromMotions(templates, 4, () => 0);

    expect(generated.solo.steps).toHaveLength(4);
    expect(generated.solo.steps[0]!.startLocation).toBe(
      generated.solo.steps[3]!.endLocation
    );
    expect(generated.solo.steps[0]!.startOrientation).toBe(
      generated.solo.steps[3]!.endOrientation
    );
    expect(generated.loopSpec[LOOPComponent.REWOUND]).toEqual({ period: 2 });
  });

  it("rejects lengths that cannot close through a period-two LOOP", () => {
    expect(() => generateRewoundSoloLoopFromMotions(templates, 3)).toThrow(
      /positive even length/
    );
  });

  it("generates a transformed solo LOOP before using the rewound fallback", () => {
    const generated = generateStructuredSoloLoopFromMotions(
      templates,
      4,
      () => 0
    );

    expect(generated.loopSpec[LOOPComponent.ROTATED]).toEqual({ period: 4 });
    expect(generated.solo.steps.map((step) => step.startLocation)).toEqual([
      GridLocation.NORTH,
      GridLocation.EAST,
      GridLocation.SOUTH,
      GridLocation.WEST,
    ]);
  });
});
