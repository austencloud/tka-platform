import { describe, expect, it } from "vitest";
import { planUpperBodyStanceYaw } from "$lib/shared/3d/collision/upper-body-stance-planner";

describe("planUpperBodyStanceYaw", () => {
  it("turns the shoulders toward two east-side targets", () => {
    const yaw = planUpperBodyStanceYaw({
      blue: { x: 0.48, z: 0.3 },
      red: { x: 0.44, z: 0.3 },
    });

    expect(yaw).toBeGreaterThan((45 * Math.PI) / 180);
    expect(yaw).toBeLessThanOrEqual((75 * Math.PI) / 180);
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
    expect(
      planUpperBodyStanceYaw({
        blue: { x: 0.45, z: 0.3 },
        red: { x: -0.45, z: 0.3 },
      })
    ).toBe(0);
  });

  it("stays square inside the centered dead zone", () => {
    expect(
      planUpperBodyStanceYaw({
        blue: { x: 0.04, z: 0.3 },
        red: { x: 0.06, z: 0.3 },
      })
    ).toBe(0);
  });
});
