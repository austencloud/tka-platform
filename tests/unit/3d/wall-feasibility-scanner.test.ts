import { describe, it, expect } from "vitest";
import { Plane } from "@austencloud/scene-3d";
import {
  MotionType,
  RotationDirection,
  Orientation,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  scanStepPair,
  scanSequenceSteps,
} from "$lib/shared/3d/services/wall-feasibility-scanner";
import type { MotionConfig3D } from "$lib/shared/3d/domain/models/motion-data-3d";

function motion(overrides: Partial<MotionConfig3D>): MotionConfig3D {
  return {
    plane: Plane.WALL,
    startLocation: "n" as GridLocation,
    endLocation: "e" as GridLocation,
    motionType: MotionType.PRO,
    rotationDirection: RotationDirection.CLOCKWISE,
    turns: 0,
    startOrientation: Orientation.IN,
    endOrientation: Orientation.IN,
    ...overrides,
  };
}

describe("scanStepPair", () => {
  it("far-apart static holds are clean", () => {
    // blue is the LEFT hand (leftShoulder.x < 0), so its grid location must
    // map to the character's left (negative world X) — "e" does that here;
    // "w" maps to +X (character's right). Swapped vs. naive compass intuition.
    const blue = motion({ motionType: MotionType.STATIC, startLocation: "e" as GridLocation, endLocation: "e" as GridLocation, rotationDirection: RotationDirection.NO_ROTATION });
    const red = motion({ motionType: MotionType.STATIC, startLocation: "w" as GridLocation, endLocation: "w" as GridLocation, rotationDirection: RotationDirection.NO_ROTATION });
    const result = scanStepPair(blue, red);
    expect(result.clean).toBe(true);
    expect(result.collisions).toHaveLength(0);
  });

  it("crossing dashes through center collide", () => {
    const blue = motion({ motionType: MotionType.DASH, startLocation: "w" as GridLocation, endLocation: "e" as GridLocation, rotationDirection: RotationDirection.NO_ROTATION });
    const red = motion({ motionType: MotionType.DASH, startLocation: "e" as GridLocation, endLocation: "w" as GridLocation, rotationDirection: RotationDirection.NO_ROTATION });
    const result = scanStepPair(blue, red);
    expect(result.clean).toBe(false);
    expect(result.collisions.length).toBeGreaterThan(0);
  });
});

describe("scanSequenceSteps", () => {
  it("verdict true when all steps clean, false when any flagged", () => {
    const cleanStep = {
      blue: motion({ motionType: MotionType.STATIC, startLocation: "e" as GridLocation, endLocation: "e" as GridLocation, rotationDirection: RotationDirection.NO_ROTATION }),
      red: motion({ motionType: MotionType.STATIC, startLocation: "w" as GridLocation, endLocation: "w" as GridLocation, rotationDirection: RotationDirection.NO_ROTATION }),
    };
    const dirtyStep = {
      blue: motion({ motionType: MotionType.DASH, startLocation: "w" as GridLocation, endLocation: "e" as GridLocation, rotationDirection: RotationDirection.NO_ROTATION }),
      red: motion({ motionType: MotionType.DASH, startLocation: "e" as GridLocation, endLocation: "w" as GridLocation, rotationDirection: RotationDirection.NO_ROTATION }),
    };
    expect(scanSequenceSteps([cleanStep]).wallFeasible).toBe(true);
    const flagged = scanSequenceSteps([cleanStep, dirtyStep]);
    expect(flagged.wallFeasible).toBe(false);
    expect(flagged.flaggedSteps).toEqual([1]);
  });
});
