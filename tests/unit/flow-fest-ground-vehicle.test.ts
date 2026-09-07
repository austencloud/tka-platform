import { describe, expect, it } from "vitest";
import {
  flowFestGroundVehicleGamepadInput,
  flowFestGroundVehicleKeyboardInput,
  mergeFlowFestGroundVehicleInput,
  reconcileFlowFestGroundVehicleTravel,
  wrapFlowFestGroundVehicleAngle,
} from "../../src/lib/features/flow-fest-sim/domain/flow-fest-ground-vehicle";
import {
  flowFestEucKeyboardInput,
  reconcileFlowFestEucCollision,
  wrapFlowFestEucAngle,
} from "../../src/lib/features/flow-fest-sim/domain/flow-fest-electric-unicycle";

const MAX_GRADE = Math.tan((42 * Math.PI) / 180) + 0.05;

describe("Flow Fest shared ground-vehicle primitives", () => {
  it("keeps the EUC names as aliases of the shared owner", () => {
    expect(flowFestEucKeyboardInput).toBe(flowFestGroundVehicleKeyboardInput);
    expect(wrapFlowFestEucAngle).toBe(wrapFlowFestGroundVehicleAngle);
  });

  it("turns S into brake when rolling and reverse from standstill, positive steer is left", () => {
    expect(flowFestGroundVehicleKeyboardInput(["KeyS", "KeyA"], 4)).toEqual({
      throttle: 0,
      brake: 1,
      steer: 1,
      performanceMode: false,
      source: "keyboard",
    });
    expect(flowFestGroundVehicleKeyboardInput(["ArrowDown", "KeyD"], 0.1)).toEqual({
      throttle: -1,
      brake: 0,
      steer: -1,
      performanceMode: false,
      source: "keyboard",
    });
  });

  it("merges the larger thumbstick over a held key and reports a mixed source", () => {
    const keyboard = flowFestGroundVehicleKeyboardInput(["KeyW"], 3);
    const gamepad = flowFestGroundVehicleGamepadInput(
      {
        connected: true,
        mapping: "standard",
        axes: [-0.5, 0],
        buttons: Array.from({ length: 8 }, () => ({ pressed: false, value: 0 })),
      },
      3
    );
    // −0.5 on axis 0 after the 0.12 dead zone remaps to +0.43 (left).
    expect(gamepad.steer).toBeCloseTo((0.5 - 0.12) / 0.88, 6);
    const merged = mergeFlowFestGroundVehicleInput(keyboard, gamepad);
    expect(merged.throttle).toBe(1);
    expect(merged.steer).toBeCloseTo(gamepad.steer, 6);
    expect(merged.source).toBe("mixed");
  });

  it("wraps headings into (−π, π]", () => {
    expect(wrapFlowFestGroundVehicleAngle(Math.PI * 3)).toBeCloseTo(Math.PI, 9);
    expect(wrapFlowFestGroundVehicleAngle(-Math.PI * 1.5)).toBeCloseTo(
      Math.PI / 2,
      9
    );
  });

  it("reports collision-limited travel along the heading and ignores a grounded climb", () => {
    const heading = 1.616;
    const current = { speedMetersPerSecond: 10, headingRadians: heading };
    const requested = {
      x: Math.sin(heading) * 10,
      z: Math.cos(heading) * 10,
    };
    const blocked = reconcileFlowFestGroundVehicleTravel(
      current,
      { x: requested.x * 0.5, y: 0, z: requested.z * 0.5 },
      requested,
      { maximumGradeRatio: MAX_GRADE }
    );
    expect(blocked.limited).toBe(true);
    expect(blocked.speedMetersPerSecond).toBeCloseTo(5, 6);

    // A 30° climb resolves 8.66 m/s planar + 5 m/s vertical: full travel.
    const climbing = reconcileFlowFestGroundVehicleTravel(
      current,
      { x: requested.x * 0.866, y: 5, z: requested.z * 0.866 },
      requested,
      { maximumGradeRatio: MAX_GRADE }
    );
    expect(climbing.limited).toBe(false);
    expect(climbing.speedMetersPerSecond).toBe(10);

    // The EUC wrapper keeps its visual pitch nudge on a limited frame.
    const euc = reconcileFlowFestEucCollision(
      {
        speedMetersPerSecond: 10,
        headingRadians: heading,
        wheelRotationRadians: 0,
        leanRadians: 0,
        pitchRadians: 0,
        batteryPercent: 80,
        odometerMeters: 0,
      },
      { x: 0, y: 0, z: 0 },
      requested
    );
    expect(euc.speedMetersPerSecond).toBe(0);
    expect(euc.pitchRadians).toBeCloseTo(0.14 * 0.7, 6);
  });
});
