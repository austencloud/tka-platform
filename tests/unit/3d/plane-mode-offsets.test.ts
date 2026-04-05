import { describe, it, expect } from "vitest";
import { PLANE_MODE_CONFIGS } from "$lib/shared/3d/domain/constants/plane-mode-configs";
import { PlaneMode } from "$lib/shared/3d/domain/enums/PlaneMode";
import { Plane } from "$lib/shared/3d/domain/enums/Plane";
import { PropStateInterpolator } from "$lib/shared/3d/services/implementations/PropStateInterpolator";
import { AngleMathCalculator } from "$lib/shared/3d/services/implementations/AngleMathCalculator";
import { OrientationMapper } from "$lib/shared/3d/services/implementations/OrientationMapper";
import { MotionCalculator } from "$lib/shared/3d/services/implementations/MotionCalculator";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  MotionType,
  RotationDirection,
  Orientation,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

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

describe("lateral offset through PropStateInterpolator", () => {
  const angleMath = new AngleMathCalculator();
  const orientationService = new OrientationMapper();
  const interpolator = new PropStateInterpolator(
    angleMath,
    orientationService,
    new MotionCalculator(angleMath, orientationService)
  );

  // STATIC at NORTH on WHEEL plane: x=0 at all progress values
  const baseConfig = {
    plane: Plane.WHEEL,
    startLocation: GridLocation.NORTH,
    endLocation: GridLocation.NORTH,
    motionType: MotionType.STATIC,
    rotationDirection: RotationDirection.NO_ROTATION,
    turns: 0,
    startOrientation: Orientation.IN,
    endOrientation: Orientation.IN,
  };

  it("no offset produces Z=approx 0 on WHEEL plane at NORTH", () => {
    // WHEEL NORTH: (0, radius, 0) — Z component from -cos(-π/2) * r = 0
    const result = interpolator.calculatePropState(baseConfig, 0);
    expect(result.worldPosition.x).toBeCloseTo(0);
  });

  it("WHEEL lateralOffset shifts worldPosition.z (maps to X_world after facing rotation)", () => {
    const result = interpolator.calculatePropState(
      { ...baseConfig, lateralOffset: 0.18 },
      0
    );
    // WHEEL NORTH: Z = -cos(-π/2) * r ≈ 0. Offset adds 0.18.
    expect(result.worldPosition.z).toBeCloseTo(0.18);
  });

  it("opposing offsets separate hands in Z", () => {
    const left = interpolator.calculatePropState(
      { ...baseConfig, lateralOffset: 0.18 },
      0
    );
    const right = interpolator.calculatePropState(
      { ...baseConfig, lateralOffset: -0.18 },
      0
    );
    // Separation is purely in Z (0.36m apart)
    expect(left.worldPosition.z - right.worldPosition.z).toBeCloseTo(0.36);
  });
});
