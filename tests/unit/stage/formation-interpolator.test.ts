import { describe, it, expect } from "vitest";
import {
  interpolateFormation,
  applyEasing,
} from "$lib/features/stage/state/formation-interpolator";
import type {
  FormationKeyframe,
  TransitionConfig,
} from "$lib/features/stage/domain/stage-types";

describe("formation-interpolator", () => {
  const from: FormationKeyframe = {
    id: "f1",
    beat: 0,
    positions: [
      { performerId: "p1", x: 2, z: 4, facing: 0 },
      { performerId: "p2", x: 5, z: 4, facing: 0 },
      { performerId: "p3", x: 8, z: 4, facing: 0 },
      { performerId: "p4", x: 5, z: 2, facing: 0 },
    ],
  };

  const to: FormationKeyframe = {
    id: "f2",
    beat: 4,
    positions: [
      { performerId: "p1", x: 5, z: 2, facing: 0 },
      { performerId: "p2", x: 3, z: 5, facing: 0 },
      { performerId: "p3", x: 7, z: 5, facing: 0 },
      { performerId: "p4", x: 5, z: 7, facing: 0 },
    ],
  };

  const linearTransition: TransitionConfig = {
    interpolation: "linear",
    easing: "linear",
  };

  it("returns 'from' positions at progress 0", () => {
    const result = interpolateFormation(from, to, 0, linearTransition);
    expect(result[0].x).toBeCloseTo(2);
    expect(result[0].z).toBeCloseTo(4);
  });

  it("returns 'to' positions at progress 1", () => {
    const result = interpolateFormation(from, to, 1, linearTransition);
    expect(result[0].x).toBeCloseTo(5);
    expect(result[0].z).toBeCloseTo(2);
  });

  it("returns midpoint at progress 0.5", () => {
    const result = interpolateFormation(from, to, 0.5, linearTransition);
    expect(result[0].x).toBeCloseTo(3.5);
    expect(result[0].z).toBeCloseTo(3);
  });

  it("interpolates facing via shortest arc", () => {
    const fromFacing: FormationKeyframe = {
      id: "f1",
      beat: 0,
      positions: [{ performerId: "p1", x: 5, z: 5, facing: 0 }],
    };
    const toFacing: FormationKeyframe = {
      id: "f2",
      beat: 4,
      positions: [{ performerId: "p1", x: 5, z: 5, facing: Math.PI / 2 }],
    };
    const result = interpolateFormation(fromFacing, toFacing, 0.5, linearTransition);
    expect(result[0].facing).toBeCloseTo(Math.PI / 4);
  });

  it("applies easeInOut easing", () => {
    expect(applyEasing(0, "easeInOut")).toBe(0);
    expect(applyEasing(1, "easeInOut")).toBe(1);
    expect(applyEasing(0.5, "easeInOut")).toBeCloseTo(0.5);
    expect(applyEasing(0.25, "easeInOut")).toBeLessThan(0.25);
  });

  it("computes speed between formations", () => {
    const result = interpolateFormation(from, to, 0.5, linearTransition);
    expect(result[0].speed).toBeGreaterThan(0);
  });
});
