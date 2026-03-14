import { describe, it, expect } from "vitest";
import { HandPropStateFactory } from "$lib/features/hand-path-builder/services/implementations/HandPropStateFactory";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

describe("HandPropStateFactory", () => {
  const factory = new HandPropStateFactory();

  it("returns staffRotationAngle of 0 for all locations", () => {
    const locations = [
      GridLocation.NORTH, GridLocation.EAST,
      GridLocation.SOUTH, GridLocation.WEST,
      GridLocation.NORTHEAST, GridLocation.SOUTHEAST,
      GridLocation.SOUTHWEST, GridLocation.NORTHWEST,
    ];
    for (const loc of locations) {
      const state = factory.locationToPropState(loc);
      expect(state.staffRotationAngle).toBe(0);
    }
  });

  it("maps EAST to centerPathAngle 0", () => {
    const state = factory.locationToPropState(GridLocation.EAST);
    expect(state.centerPathAngle).toBe(0);
  });

  it("maps SOUTH to centerPathAngle PI/2", () => {
    const state = factory.locationToPropState(GridLocation.SOUTH);
    expect(state.centerPathAngle).toBeCloseTo(Math.PI / 2);
  });

  it("maps NORTH to centerPathAngle -PI/2", () => {
    const state = factory.locationToPropState(GridLocation.NORTH);
    expect(state.centerPathAngle).toBeCloseTo(-Math.PI / 2);
  });

  it("maps WEST to centerPathAngle PI", () => {
    const state = factory.locationToPropState(GridLocation.WEST);
    expect(state.centerPathAngle).toBeCloseTo(Math.PI);
  });

  it("does not set x/y for non-dash locations", () => {
    const state = factory.locationToPropState(GridLocation.NORTH);
    expect(state.x).toBeUndefined();
    expect(state.y).toBeUndefined();
  });
});
