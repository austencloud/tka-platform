/**
 * Regression test: 3D prop start orientation must match sequence data.
 *
 * The 3D viewer has repeatedly shown IN/OUT orientations swapped.
 * This test locks down the complete pipeline:
 *   SequenceData → SequenceConverter → PropStateInterpolator → world position + rotation
 *
 * If this test fails, the 3D viewer is showing wrong orientations.
 */

import { describe, it, expect } from "vitest";
import { Vector3, Quaternion, Euler } from "three";
import { Orientation, MotionType } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { Plane } from "$lib/shared/3d/domain/enums/Plane";
import { LOCATION_ANGLES } from "$lib/features/compose/shared/domain/math-constants";
import {
  planeAngleToWorldPosition,
  calculatePropQuaternion,
  GRID_RADIUS_3D,
} from "$lib/shared/3d/domain/constants/plane-transforms";
import { OrientationMapper } from "$lib/shared/3d/services/implementations/OrientationMapper";
import { AngleMathCalculator } from "$lib/shared/3d/services/implementations/AngleMathCalculator";
import { MotionCalculator } from "$lib/shared/3d/services/implementations/MotionCalculator";
import { PropStateInterpolator } from "$lib/shared/3d/services/implementations/PropStateInterpolator";
import type { MotionConfig3D } from "$lib/shared/3d/domain/models/MotionData3D";

// Build the interpolator with real services (same as DI container)
const angleMath = new AngleMathCalculator();
const orientationMapper = new OrientationMapper();
const motionCalculator = new MotionCalculator(angleMath, orientationMapper);
const interpolator = new PropStateInterpolator(
  angleMath,
  orientationMapper,
  motionCalculator
);

/**
 * Helper: compute the world direction the T-bar (thumb end) points toward.
 *
 * Must replicate the full rotation chain from Staff3D:
 *   finalQuat = facingQuat * worldRotation * horizontalQuat
 * where horizontalQuat = Euler(0, 0, PI/2) makes the cylinder horizontal,
 * and facingAngle=0 (identity) in our viewer.
 *
 * The T-bar is at -halfLength along the staff's local Y axis (negative end).
 * For IN orientation, the T-bar should point TOWARD grid center.
 * For OUT orientation, the T-bar should point AWAY from grid center.
 */
function getTBarDirection(staffAngle: number, plane: Plane): Vector3 {
  const worldRot = calculatePropQuaternion(plane, staffAngle);
  // Staff3D applies horizontal rotation: Euler(0, 0, PI/2)
  const horizontalQuat = new Quaternion().setFromEuler(new Euler(0, 0, Math.PI / 2));
  const fullQuat = worldRot.clone().multiply(horizontalQuat);
  // T-bar is at -Y in local space (we moved it to -halfLength)
  const tBarLocal = new Vector3(0, -1, 0);
  const tBarWorld = tBarLocal.applyQuaternion(fullQuat);
  return tBarWorld;
}

/**
 * For a prop at a grid location with a given orientation,
 * verify the T-bar points in the correct direction.
 *
 * IN = T-bar points toward center (opposite of the position direction)
 * OUT = T-bar points away from center (same as the position direction)
 */
function verifyOrientation(
  location: GridLocation,
  orientation: Orientation,
  plane: Plane = Plane.WALL
) {
  const centerAngle = LOCATION_ANGLES[location];
  const staffAngle = orientationMapper.mapOrientationToAngle(orientation, centerAngle);
  const propPosition = planeAngleToWorldPosition(plane, centerAngle);
  const tBarDir = getTBarDirection(staffAngle, plane);

  // The prop position vector points from center to the prop's grid location.
  // Normalize it to get the "outward" direction.
  const outwardDir = propPosition.clone().normalize();

  // Dot product: positive = same direction (OUT), negative = opposite (IN)
  const dot = tBarDir.dot(outwardDir);

  return { staffAngle, propPosition, tBarDir, outwardDir, dot, centerAngle };
}

describe("3D Prop Orientation", () => {
  describe("Wall plane — IN orientation", () => {
    // IN means T-bar points TOWARD center (dot product should be negative)
    const locations = [
      GridLocation.NORTH,
      GridLocation.EAST,
      GridLocation.SOUTH,
      GridLocation.WEST,
    ];

    for (const loc of locations) {
      it(`IN at ${loc}: T-bar points toward center`, () => {
        const result = verifyOrientation(loc, Orientation.IN, Plane.WALL);
        expect(result.dot).toBeLessThan(0);
      });
    }
  });

  describe("Wall plane — OUT orientation", () => {
    // OUT means T-bar points AWAY from center (dot product should be positive)
    const locations = [
      GridLocation.NORTH,
      GridLocation.EAST,
      GridLocation.SOUTH,
      GridLocation.WEST,
    ];

    for (const loc of locations) {
      it(`OUT at ${loc}: T-bar points away from center`, () => {
        const result = verifyOrientation(loc, Orientation.OUT, Plane.WALL);
        expect(result.dot).toBeGreaterThan(0);
      });
    }
  });

  describe("Full pipeline — PropStateInterpolator at progress=0", () => {
    it("static IN at south: prop at south, T-bar toward center", () => {
      const config: MotionConfig3D = {
        plane: Plane.WALL,
        startLocation: GridLocation.SOUTH,
        endLocation: GridLocation.SOUTH,
        motionType: MotionType.STATIC,
        rotationDirection: "noRotation" as any,
        turns: 0,
        startOrientation: Orientation.IN,
        endOrientation: Orientation.IN,
      };

      const state = interpolator.calculatePropState(config, 0);

      // Position should be at south: X≈0, Y<0 (south = down)
      expect(state.worldPosition.x).toBeCloseTo(0, 1);
      expect(state.worldPosition.y).toBeLessThan(0);

      // T-bar direction: should point toward center (upward, +Y)
      const tBarDir = getTBarDirection(state.staffRotationAngle, Plane.WALL);
      // South position is at -Y, so toward center = +Y direction
      expect(tBarDir.y).toBeGreaterThan(0);
    });

    it("static OUT at east: prop at east, T-bar away from center", () => {
      const config: MotionConfig3D = {
        plane: Plane.WALL,
        startLocation: GridLocation.EAST,
        endLocation: GridLocation.EAST,
        motionType: MotionType.STATIC,
        rotationDirection: "noRotation" as any,
        turns: 0,
        startOrientation: Orientation.OUT,
        endOrientation: Orientation.OUT,
      };

      const state = interpolator.calculatePropState(config, 0);

      // Position should be at east: X>0, Y≈0
      expect(state.worldPosition.x).toBeGreaterThan(0);
      expect(state.worldPosition.y).toBeCloseTo(0, 1);

      // T-bar direction: should point away from center (+X, same as position)
      const tBarDir = getTBarDirection(state.staffRotationAngle, Plane.WALL);
      expect(tBarDir.x).toBeGreaterThan(0);
    });

    it("static IN at north: prop at north, T-bar toward center", () => {
      const config: MotionConfig3D = {
        plane: Plane.WALL,
        startLocation: GridLocation.NORTH,
        endLocation: GridLocation.NORTH,
        motionType: MotionType.STATIC,
        rotationDirection: "noRotation" as any,
        turns: 0,
        startOrientation: Orientation.IN,
        endOrientation: Orientation.IN,
      };

      const state = interpolator.calculatePropState(config, 0);

      // Position should be at north: X≈0, Y>0
      expect(state.worldPosition.x).toBeCloseTo(0, 1);
      expect(state.worldPosition.y).toBeGreaterThan(0);

      // T-bar direction: should point toward center (downward, -Y)
      const tBarDir = getTBarDirection(state.staffRotationAngle, Plane.WALL);
      expect(tBarDir.y).toBeLessThan(0);
    });

    it("static IN at west: prop at west, T-bar toward center", () => {
      const config: MotionConfig3D = {
        plane: Plane.WALL,
        startLocation: GridLocation.WEST,
        endLocation: GridLocation.WEST,
        motionType: MotionType.STATIC,
        rotationDirection: "noRotation" as any,
        turns: 0,
        startOrientation: Orientation.IN,
        endOrientation: Orientation.IN,
      };

      const state = interpolator.calculatePropState(config, 0);

      // Position should be at west: X<0, Y≈0
      expect(state.worldPosition.x).toBeLessThan(0);
      expect(state.worldPosition.y).toBeCloseTo(0, 1);

      // T-bar direction: should point toward center (+X)
      const tBarDir = getTBarDirection(state.staffRotationAngle, Plane.WALL);
      expect(tBarDir.x).toBeGreaterThan(0);
    });
  });

  describe("Position sanity — grid locations map to correct world positions", () => {
    it("east → +X (performer's right, screen right from behind)", () => {
      const pos = planeAngleToWorldPosition(Plane.WALL, LOCATION_ANGLES[GridLocation.EAST]);
      expect(pos.x).toBeGreaterThan(0);
      expect(Math.abs(pos.y)).toBeLessThan(0.01);
    });

    it("west → -X (performer's left, screen left from behind)", () => {
      const pos = planeAngleToWorldPosition(Plane.WALL, LOCATION_ANGLES[GridLocation.WEST]);
      expect(pos.x).toBeLessThan(0);
      expect(Math.abs(pos.y)).toBeLessThan(0.01);
    });

    it("north → +Y (up)", () => {
      const pos = planeAngleToWorldPosition(Plane.WALL, LOCATION_ANGLES[GridLocation.NORTH]);
      expect(pos.y).toBeGreaterThan(0);
      expect(Math.abs(pos.x)).toBeLessThan(0.01);
    });

    it("south → -Y (down)", () => {
      const pos = planeAngleToWorldPosition(Plane.WALL, LOCATION_ANGLES[GridLocation.SOUTH]);
      expect(pos.y).toBeLessThan(0);
      expect(Math.abs(pos.x)).toBeLessThan(0.01);
    });
  });
});
