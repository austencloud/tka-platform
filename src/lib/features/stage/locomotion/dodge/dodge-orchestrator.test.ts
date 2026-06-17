import { describe, it, expect } from "vitest";
import { Plane } from "@austencloud/scene-3d";
import {
  MotionType,
  RotationDirection,
  Orientation,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { solveDodge } from "./dodge-orchestrator";
import type { MotionConfig3D } from "$lib/shared/3d/domain/models/motion-data-3d";

// alpha1: LH (blue) on wheel plane spinning at south; RH (red) on wall at north.
const blue: MotionConfig3D = {
  plane: Plane.WHEEL,
  startLocation: GridLocation.SOUTH,
  endLocation: GridLocation.SOUTH,
  motionType: MotionType.STATIC,
  rotationDirection: RotationDirection.CLOCKWISE,
  turns: 2,
  startOrientation: Orientation.IN,
  endOrientation: Orientation.IN,
};
const red: MotionConfig3D = {
  plane: Plane.WALL,
  startLocation: GridLocation.NORTH,
  endLocation: GridLocation.NORTH,
  motionType: MotionType.STATIC,
  rotationDirection: RotationDirection.CLOCKWISE,
  turns: 2,
  startOrientation: Orientation.IN,
  endOrientation: Orientation.IN,
};

describe("solveDodge", () => {
  it("returns a balanced stance that clears the body intrusion", () => {
    const sol = solveDodge(blue, red, 1.8);
    expect(sol.worstBodyDepth).toBeLessThan(0.01);
    expect(Number.isFinite(sol.stance.footOffsetX)).toBe(true);
    expect(Number.isFinite(sol.stance.rootYawRad)).toBe(true);
  });
});
