import { describe, expect, it } from "vitest";
import {
  planUpperBodyStance,
  planUpperBodyStanceYaw,
} from "$lib/shared/3d/collision/upper-body-stance-planner";

describe("planUpperBodyStanceYaw", () => {
  it("faces east when both grips move east", () => {
    const targets = {
      left: { x: 0.48, z: 0.3 },
      right: { x: 0.44, z: 0.3 },
    };
    const yaw = planUpperBodyStanceYaw(targets);
    const plan = planUpperBodyStance(targets);

    expect(yaw).toBeCloseTo(Math.PI / 2, 8);
    expect(plan.pitchRad).toBe(0);
    expect(plan.leftDepthOffsetM).toBeCloseTo(0.16, 8);
    expect(plan.rightDepthOffsetM).toBe(0);
  });

  it("faces west when both grips move west", () => {
    const targets = {
      left: { x: -0.48, z: 0.3 },
      right: { x: -0.44, z: 0.3 },
    };
    const yaw = planUpperBodyStanceYaw(targets);
    const plan = planUpperBodyStance(targets);

    expect(yaw).toBeCloseTo(-Math.PI / 2, 8);
    expect(plan.leftDepthOffsetM).toBe(0);
    expect(plan.rightDepthOffsetM).toBeCloseTo(0.16, 8);
  });

  it("does not dilute a side stance with the wall plane depth offset", () => {
    const near = planUpperBodyStanceYaw({
      left: { x: 0.48, z: 0.15 },
      right: { x: 0.44, z: 0.15 },
    });
    const far = planUpperBodyStanceYaw({
      left: { x: 0.48, z: 0.9 },
      right: { x: 0.44, z: 0.9 },
    });

    expect(far).toBeCloseTo(near, 8);
    expect(near).toBeCloseTo(Math.PI / 2, 8);
  });

  it("stays square for opposed targets", () => {
    const plan = planUpperBodyStance({
      left: { x: 0.45, z: 0.3 },
      right: { x: -0.45, z: 0.3 },
    });
    expect(plan).toEqual({
      yawRad: 0,
      pitchRad: 0,
      leftDepthOffsetM: 0,
      rightDepthOffsetM: 0,
    });
  });

  it("stays square inside the centered dead zone", () => {
    const plan = planUpperBodyStance({
      left: { x: 0.04, z: 0.3 },
      right: { x: 0.06, z: 0.3 },
    });
    expect(plan).toEqual({
      yawRad: 0,
      pitchRad: 0,
      leftDepthOffsetM: 0,
      rightDepthOffsetM: 0,
    });
  });
});
