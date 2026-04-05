import { describe, it, expect } from "vitest";
import { PLANE_MODE_CONFIGS } from "$lib/shared/3d/domain/constants/plane-mode-configs";
import { PlaneMode } from "$lib/shared/3d/domain/enums/PlaneMode";
import { Plane } from "$lib/shared/3d/domain/enums/Plane";

describe("PlaneModeConfigs", () => {
  it("wall mode uses WALL plane for both hands with zero offset", () => {
    const config = PLANE_MODE_CONFIGS[PlaneMode.WALL];
    expect(config.bluePlane).toBe(Plane.WALL);
    expect(config.redPlane).toBe(Plane.WALL);
    expect(config.blueLateralOffset).toBe(0);
    expect(config.redLateralOffset).toBe(0);
    expect(config.facingAngle).toBe(0);
  });

  it("dual wheel mode uses WHEEL plane with opposing lateral offsets", () => {
    const config = PLANE_MODE_CONFIGS[PlaneMode.DUAL_WHEEL];
    expect(config.bluePlane).toBe(Plane.WHEEL);
    expect(config.redPlane).toBe(Plane.WHEEL);
    expect(config.blueLateralOffset).toBeGreaterThan(0);
    expect(config.redLateralOffset).toBeLessThan(0);
    expect(config.blueLateralOffset).toBe(-config.redLateralOffset);
    expect(config.facingAngle).toBeCloseTo(Math.PI / 2);
  });
});
