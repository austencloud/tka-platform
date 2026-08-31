import { describe, expect, it } from "vitest";
import {
  planUpperBodyStance,
  planUpperBodyStanceYaw,
} from "$lib/shared/3d/collision/upper-body-stance-planner";

describe("planUpperBodyStanceYaw", () => {
  it("turns the shoulders toward two east-side targets", () => {
    const targets = {
      blue: { x: 0.48, z: 0.3 },
      red: { x: 0.44, z: 0.3 },
    };
    const yaw = planUpperBodyStanceYaw(targets);
    const plan = planUpperBodyStance(targets);

    expect(yaw).toBeGreaterThan((45 * Math.PI) / 180);
    expect(yaw).toBeLessThanOrEqual((75 * Math.PI) / 180);
    expect(plan.pitchRad).toBeCloseTo((18 * Math.PI) / 180, 6);
  });

  it("turns the opposite direction for two west-side targets", () => {
    const yaw = planUpperBodyStanceYaw({
      blue: { x: -0.48, z: 0.3 },
      red: { x: -0.44, z: 0.3 },
    });

    expect(yaw).toBeLessThan((-45 * Math.PI) / 180);
    expect(yaw).toBeGreaterThanOrEqual((-75 * Math.PI) / 180);
  });

  it("stays square for opposed targets", () => {
    const plan = planUpperBodyStance({
      blue: { x: 0.45, z: 0.3 },
      red: { x: -0.45, z: 0.3 },
    });
    expect(plan).toEqual({ yawRad: 0, pitchRad: 0 });
  });

  it("stays square inside the centered dead zone", () => {
    const plan = planUpperBodyStance({
      blue: { x: 0.04, z: 0.3 },
      red: { x: 0.06, z: 0.3 },
    });
    expect(plan).toEqual({ yawRad: 0, pitchRad: 0 });
  });
});
