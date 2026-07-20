import { describe, it, expect } from "vitest";
import { Plane } from "@austencloud/scene-3d";
import {
  MotionType,
  RotationDirection,
  Orientation,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { calculatePropState } from "$lib/shared/3d/services/prop-state-interpolator";
import { GRID_RADIUS_3D } from "$lib/shared/3d/domain/constants/plane-transforms";
import { BASE_DIP_RADIUS } from "$lib/shared/3d/services/petal-path";
import type { MotionConfig3D } from "$lib/shared/3d/domain/models/motion-data-3d";

function antiConfig(turns: number, concaveDepth?: number): MotionConfig3D {
  return {
    plane: Plane.WALL,
    startLocation: "n" as GridLocation,
    endLocation: "e" as GridLocation,
    motionType: MotionType.ANTI,
    rotationDirection: RotationDirection.CLOCKWISE,
    turns,
    startOrientation: Orientation.IN,
    endOrientation: Orientation.IN,
    pathShape: "concave",
    concaveDepth,
  };
}

function radius(config: MotionConfig3D, progress: number): number {
  const s = calculatePropState(config, progress);
  return s.worldPosition.length() / GRID_RADIUS_3D;
}

describe("concave interpolation (petal model)", () => {
  it("starts and ends on the grid radius", () => {
    const c = antiConfig(0);
    expect(radius(c, 0)).toBeCloseTo(1, 4);
    expect(radius(c, 1)).toBeCloseTo(1, 4);
  });

  it("0 turns, k absent: mid-step dips to legacy reflection radius", () => {
    expect(radius(antiConfig(0), 0.5)).toBeCloseTo(BASE_DIP_RADIUS, 3);
  });

  it("1 turn: valley at mid-step (radius back at 1), dips at quarter points", () => {
    const c = antiConfig(1);
    expect(radius(c, 0.5)).toBeCloseTo(1, 3);
    expect(radius(c, 0.25)).toBeCloseTo(BASE_DIP_RADIUS, 3);
    expect(radius(c, 0.75)).toBeCloseTo(BASE_DIP_RADIUS, 3);
  });

  it("concaveDepth=1 pulls dips to the center", () => {
    expect(radius(antiConfig(0, 1), 0.5)).toBeCloseTo(0, 3);
    expect(radius(antiConfig(1, 1), 0.25)).toBeCloseTo(0, 3);
  });
});
