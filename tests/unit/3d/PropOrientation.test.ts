/**
 * Regression test: 3D prop orientation and position.
 *
 * Camera at +Z, avatar faces -Z. In Three.js right-handed coords,
 * from +Z looking -Z: +X = screen RIGHT. No coordinate mirroring needed.
 *
 * East (+X) = screen right = performer's right from behind.
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
} from "$lib/shared/3d/domain/constants/plane-transforms";
import { OrientationMapper } from "$lib/shared/3d/services/implementations/OrientationMapper";
import { AngleMathCalculator } from "$lib/shared/3d/services/implementations/AngleMathCalculator";
import { MotionCalculator } from "$lib/shared/3d/services/implementations/MotionCalculator";
import { PropStateInterpolator } from "$lib/shared/3d/services/implementations/PropStateInterpolator";
import type { MotionConfig3D } from "$lib/shared/3d/domain/models/MotionData3D";

const angleMath = new AngleMathCalculator();
const orientationMapper = new OrientationMapper();
const motionCalculator = new MotionCalculator(angleMath, orientationMapper);
const interpolator = new PropStateInterpolator(angleMath, orientationMapper, motionCalculator);

/**
 * Get T-bar world direction using Staff3D's full rotation chain:
 *   facingQuat(identity for test) * worldRotation * horizontalQuat(Z+90°)
 * T-bar at -halfLength (-Y local).
 */
function getTBarDirection(staffAngle: number, plane: Plane): Vector3 {
  const worldRot = calculatePropQuaternion(plane, staffAngle);
  const horizontalQuat = new Quaternion().setFromEuler(new Euler(0, 0, Math.PI / 2));
  const fullQuat = worldRot.clone().multiply(horizontalQuat);
  return new Vector3(0, -1, 0).applyQuaternion(fullQuat);
}

describe("3D Prop — no X mirror, camera at +Z", () => {

  describe("Positions: east=+X(right), west=-X(left), north=+Y(up), south=-Y(down)", () => {
    it("east → +X", () => {
      const pos = planeAngleToWorldPosition(Plane.WALL, LOCATION_ANGLES[GridLocation.EAST]);
      expect(pos.x).toBeGreaterThan(0);
      expect(Math.abs(pos.y)).toBeLessThan(0.01);
    });
    it("west → -X", () => {
      const pos = planeAngleToWorldPosition(Plane.WALL, LOCATION_ANGLES[GridLocation.WEST]);
      expect(pos.x).toBeLessThan(0);
      expect(Math.abs(pos.y)).toBeLessThan(0.01);
    });
    it("north → +Y", () => {
      const pos = planeAngleToWorldPosition(Plane.WALL, LOCATION_ANGLES[GridLocation.NORTH]);
      expect(pos.y).toBeGreaterThan(0);
      expect(Math.abs(pos.x)).toBeLessThan(0.01);
    });
    it("south → -Y", () => {
      const pos = planeAngleToWorldPosition(Plane.WALL, LOCATION_ANGLES[GridLocation.SOUTH]);
      expect(pos.y).toBeLessThan(0);
      expect(Math.abs(pos.x)).toBeLessThan(0.01);
    });
  });

  describe("Orientation: IN=toward center, OUT=away from center", () => {
    function verify(location: GridLocation, orientation: Orientation) {
      const centerAngle = LOCATION_ANGLES[location];
      const staffAngle = orientationMapper.mapOrientationToAngle(orientation, centerAngle);
      const pos = planeAngleToWorldPosition(Plane.WALL, centerAngle);
      const outwardDir = pos.clone().normalize();
      const tBar = getTBarDirection(staffAngle, Plane.WALL);
      return tBar.dot(outwardDir);
    }

    const locations = [GridLocation.NORTH, GridLocation.EAST, GridLocation.SOUTH, GridLocation.WEST];

    for (const loc of locations) {
      it(`IN at ${loc}: T-bar toward center (dot < 0)`, () => {
        expect(verify(loc, Orientation.IN)).toBeLessThan(-0.5);
      });
      it(`OUT at ${loc}: T-bar away from center (dot > 0)`, () => {
        expect(verify(loc, Orientation.OUT)).toBeGreaterThan(0.5);
      });
    }
  });

  describe("Full pipeline — PropStateInterpolator at progress=0", () => {
    function makeConfig(loc: GridLocation, ori: Orientation): MotionConfig3D {
      return {
        plane: Plane.WALL,
        startLocation: loc,
        endLocation: loc,
        motionType: MotionType.STATIC,
        rotationDirection: "noRotation" as any,
        turns: 0,
        startOrientation: ori,
        endOrientation: ori,
      };
    }

    it("IN at south: pos=-Y, T-bar toward center (+Y)", () => {
      const state = interpolator.calculatePropState(makeConfig(GridLocation.SOUTH, Orientation.IN), 0);
      expect(state.worldPosition.y).toBeLessThan(0);
      const tBar = getTBarDirection(state.staffRotationAngle, Plane.WALL);
      expect(tBar.y).toBeGreaterThan(0.5);
    });

    it("IN at east: pos=+X, T-bar toward center (-X)", () => {
      const state = interpolator.calculatePropState(makeConfig(GridLocation.EAST, Orientation.IN), 0);
      expect(state.worldPosition.x).toBeGreaterThan(0);
      const tBar = getTBarDirection(state.staffRotationAngle, Plane.WALL);
      expect(tBar.x).toBeLessThan(-0.5);
    });

    it("OUT at east: pos=+X, T-bar away from center (+X)", () => {
      const state = interpolator.calculatePropState(makeConfig(GridLocation.EAST, Orientation.OUT), 0);
      expect(state.worldPosition.x).toBeGreaterThan(0);
      const tBar = getTBarDirection(state.staffRotationAngle, Plane.WALL);
      expect(tBar.x).toBeGreaterThan(0.5);
    });

    it("IN at north: pos=+Y, T-bar toward center (-Y)", () => {
      const state = interpolator.calculatePropState(makeConfig(GridLocation.NORTH, Orientation.IN), 0);
      expect(state.worldPosition.y).toBeGreaterThan(0);
      const tBar = getTBarDirection(state.staffRotationAngle, Plane.WALL);
      expect(tBar.y).toBeLessThan(-0.5);
    });
  });
});
