import { describe, it, expect } from "vitest";
import { motionDataToConfig3D, stepDataToConfigs } from "$lib/shared/3d/services/sequence-converter";
import { Plane } from "@austencloud/scene-3d";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";

describe("SequenceConverter plane passthrough", () => {
  it("reads motion.plane when no modeConfig is active", () => {
    const motion = createMotionData({ plane: Plane.WHEEL });
    const config = motionDataToConfig3D(motion);
    expect(config.plane).toBe(Plane.WHEEL);
  });

  it("defaults to WALL when motion has no plane field", () => {
    const motion = createMotionData({});
    const config = motionDataToConfig3D(motion);
    expect(config.plane).toBe(Plane.WALL);
  });

  it("modeConfig overrides motion.plane", () => {
    const motion = createMotionData({ plane: Plane.FLOOR });
    const modeConfig = {
      facingAngle: 0,
      bluePlane: Plane.WHEEL,
      redPlane: Plane.WHEEL,
      rotationPlane: Plane.WALL,
      blueLateralOffset: 0,
      redLateralOffset: 0,
    };

    const beat = {
      stepNumber: 1,
      motions: {
        [MotionColor.BLUE]: motion,
        [MotionColor.RED]: createMotionData({ plane: Plane.FLOOR }),
      },
      duration: 1,
      blueReversal: false,
      redReversal: false,
      isBlank: false,
      id: "test",
    } as unknown as StepData;

    const result = stepDataToConfigs(beat, Plane.WALL, modeConfig);
    expect(result.blue?.plane).toBe(Plane.WHEEL);
  });

  it("uses motion.plane per-hand when modeConfig is absent", () => {
    const blueMotion = createMotionData({ plane: Plane.FLOOR, color: MotionColor.BLUE });
    const redMotion = createMotionData({ plane: Plane.WHEEL, color: MotionColor.RED });

    const beat = {
      stepNumber: 1,
      motions: {
        [MotionColor.BLUE]: blueMotion,
        [MotionColor.RED]: redMotion,
      },
      duration: 1,
      blueReversal: false,
      redReversal: false,
      isBlank: false,
      id: "test",
    } as unknown as StepData;

    const result = stepDataToConfigs(beat);
    expect(result.blue?.plane).toBe(Plane.FLOOR);
    expect(result.red?.plane).toBe(Plane.WHEEL);
  });
});
