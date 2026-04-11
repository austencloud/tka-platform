import { describe, it, expect } from "vitest";
import { Plane } from "$lib/shared/3d/domain/enums/Plane";
import { PlaneMode } from "$lib/shared/3d/domain/enums/PlaneMode";
import { derivePlaneModeFromHands } from "$lib/shared/3d/state/avatar-instance-state.svelte";

describe("derivePlaneModeFromHands", () => {
  it("returns WALL when both hands are on Wall", () => {
    expect(derivePlaneModeFromHands(Plane.WALL, Plane.WALL)).toBe(PlaneMode.WALL);
  });

  it("returns DUAL_WHEEL when both hands are on Wheel", () => {
    expect(derivePlaneModeFromHands(Plane.WHEEL, Plane.WHEEL)).toBe(PlaneMode.DUAL_WHEEL);
  });

  it("returns CUSTOM when hands are on different planes", () => {
    expect(derivePlaneModeFromHands(Plane.WALL, Plane.WHEEL)).toBe(PlaneMode.CUSTOM);
    expect(derivePlaneModeFromHands(Plane.WHEEL, Plane.FLOOR)).toBe(PlaneMode.CUSTOM);
    expect(derivePlaneModeFromHands(Plane.FLOOR, Plane.WALL)).toBe(PlaneMode.CUSTOM);
  });

  it("returns CUSTOM when both hands are on Floor (no matching preset)", () => {
    expect(derivePlaneModeFromHands(Plane.FLOOR, Plane.FLOOR)).toBe(PlaneMode.CUSTOM);
  });
});
