/**
 * 2D concave interpolation, ported onto the shared petal model
 * ($lib/shared/3d/services/petal-path). Mirrors the 3D contract in
 * tests/unit/3d/prop-state-interpolator-concave.test.ts — angle rides the
 * arc, radius = concaveRadiusProfile(progress, turns, concaveDepth).
 */
import { describe, it, expect } from "vitest";
import { interpolatePropAngles } from "$lib/shared/animation-engine/services/prop-interpolator";
import { createStepData } from "$lib/shared/foundation/domain/factories/create-step-data";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import { BASE_DIP_RADIUS } from "$lib/shared/3d/services/petal-path";
import {
  MotionColor,
  MotionType,
  Orientation,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { getPathPoints } from "$lib/features/hand-paths/hand-path-builder/services/hand-path-animator";

function radiusAt(turns: number, progress: number): number {
  const step = createStepData({
    motions: {
      [MotionColor.BLUE]: createMotionData({
        motionType: MotionType.ANTI,
        rotationDirection: RotationDirection.CLOCKWISE,
        startLocation: GridLocation.NORTH,
        endLocation: GridLocation.EAST,
        startOrientation: Orientation.IN,
        endOrientation: Orientation.IN,
        turns,
        pathShape: "concave",
      }),
    },
  });

  const result = interpolatePropAngles(step, progress);
  const angles = result.blueAngles as { x?: number; y?: number };
  const x = angles.x ?? 0;
  const y = angles.y ?? 0;
  return Math.hypot(x, y);
}

describe("2D prop-interpolator concave path (petal model)", () => {
  it("starts and ends on the grid radius", () => {
    expect(radiusAt(0, 0)).toBeCloseTo(1, 4);
    expect(radiusAt(0, 1)).toBeCloseTo(1, 4);
  });

  it("0 turns: mid-step dips to the legacy reflection radius (concaveDepth defaults to 0)", () => {
    expect(radiusAt(0, 0.5)).toBeCloseTo(BASE_DIP_RADIUS, 3);
  });

  it("1 turn: valley at mid-step (radius back at 1), dips at quarter points", () => {
    expect(radiusAt(1, 0.5)).toBeCloseTo(1, 3);
    expect(radiusAt(1, 0.25)).toBeCloseTo(BASE_DIP_RADIUS, 3);
    expect(radiusAt(1, 0.75)).toBeCloseTo(BASE_DIP_RADIUS, 3);
  });

  // MotionData has no concaveDepth field today (see motion-data.ts) — the 2D
  // interpolator can only default concaveDepth to 0 until that plumbing
  // exists. This locks the current (0-depth) behavior rather than asserting
  // depth=1 like the 3D test, which does carry concaveDepth on MotionConfig3D.
  it("concaveDepth is not wired for 2D motions yet — defaults to 0 (legacy dip depth)", () => {
    expect(radiusAt(0, 0.5)).toBeCloseTo(BASE_DIP_RADIUS, 3);
  });
});

describe("hand-path-animator concave path (petal model)", () => {
  // getPathPoints has no turns/concaveDepth input (GridLocation in/out
  // only) — both default to 0 inside interpolateConcavePoint, reproducing
  // the single mid-step dip at the legacy reflection radius.
  function radiusAt(progress: number): number {
    const points = getPathPoints(
      GridLocation.NORTH,
      GridLocation.EAST,
      4,
      "concave"
    );
    const CENTER = 475;
    const GRID_RADIUS = 143.1;
    const idx = Math.round(progress * 4);
    const p = points[idx]!;
    return Math.hypot(p.x - CENTER, p.y - CENTER) / GRID_RADIUS;
  }

  it("starts and ends on the grid radius", () => {
    expect(radiusAt(0)).toBeCloseTo(1, 3);
    expect(radiusAt(1)).toBeCloseTo(1, 3);
  });

  it("mid-step dips to the legacy reflection radius (0 turns, 0 depth defaults)", () => {
    expect(radiusAt(0.5)).toBeCloseTo(BASE_DIP_RADIUS, 3);
  });
});
