import { describe, expect, it } from "vitest";
import type { PropState } from "$lib/shared/foundation/domain/types/prop-state";
import {
  mapThirdOrderChildStep,
  resolveThirdOrderGridPose,
  THIRD_ORDER_CHILD_SCALE,
  wrapThirdOrderBeat,
} from "$lib/features/toys/tabs/third-order/domain/third-order-math";

const EAST: PropState = { centerPathAngle: 0, staffRotationAngle: 0 };

describe("third-order coordinate math", () => {
  it("wraps the master clock in both directions", () => {
    expect(wrapThirdOrderBeat(17.25, 16)).toBeCloseTo(1.25);
    expect(wrapThirdOrderBeat(-0.5, 16)).toBeCloseTo(15.5);
  });

  it("fits one complete child phrase across one carrier phrase", () => {
    expect(mapThirdOrderChildStep(4, 8, 16, "phrase")).toBeCloseTo(2);
    expect(mapThirdOrderChildStep(12, 8, 16, "phrase")).toBeCloseTo(6);
  });

  it("does not accelerate an equal-length child phrase", () => {
    expect(mapThirdOrderChildStep(3.25, 16, 16, "phrase")).toBeCloseTo(3.25);
  });

  it("supports shared and independent child clocks", () => {
    expect(mapThirdOrderChildStep(5.5, 4, 16, "beats")).toBeCloseTo(1.5);
    expect(mapThirdOrderChildStep(5.5, 4, 16, "independent", 2)).toBeCloseTo(3);
  });

  it("places an east carrier hand at the canonical hand radius", () => {
    const pose = resolveThirdOrderGridPose(EAST, EAST, "world");
    expect(pose.centerX).toBeCloseTo(625);
    expect(pose.centerY).toBeCloseTo(475);
    expect(pose.scale).toBe(THIRD_ORDER_CHILD_SCALE);
    expect(pose.scale).toBe(0.5);
  });

  it("keeps world lock stable and distinguishes radial from tangent", () => {
    const southeast: PropState = {
      centerPathAngle: Math.PI / 4,
      staffRotationAngle: 0,
    };
    const world = resolveThirdOrderGridPose(EAST, southeast, "world");
    const radial = resolveThirdOrderGridPose(EAST, southeast, "radial");
    const tangent = resolveThirdOrderGridPose(EAST, southeast, "tangent");

    expect(world.rotation).toBe(0);
    expect(radial.rotation).not.toBeCloseTo(tangent.rotation);
  });
});
