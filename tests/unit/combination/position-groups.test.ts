import { describe, it, expect } from "vitest";
import {
  positionGroup,
  seamOf,
  seamEndOf,
} from "$lib/shared/combination/services/position-groups";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import {
  GridPosition,
  GridPositionGroup,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

describe("positionGroup", () => {
  it("extracts the family from a GridPosition", () => {
    expect(positionGroup(GridPosition.ALPHA3)).toBe(GridPositionGroup.ALPHA);
    expect(positionGroup(GridPosition.BETA5)).toBe(GridPositionGroup.BETA);
    expect(positionGroup("gamma11" as GridPosition)).toBe(
      GridPositionGroup.GAMMA
    );
    expect(positionGroup("terra1")).toBe(GridPositionGroup.TERRA);
    expect(positionGroup("eta5")).toBe(GridPositionGroup.ETA);
    expect(positionGroup("tau9")).toBe(GridPositionGroup.TAU);
    expect(positionGroup("zeta16")).toBe(GridPositionGroup.ZETA);
  });

  it("returns null for unknown strings", () => {
    expect(positionGroup("nonsense9")).toBeNull();
  });

  it("returns null for a bare group name with no trailing digits", () => {
    expect(positionGroup("alpha")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(positionGroup("")).toBeNull();
  });

  it("rejects uppercase (case-sensitive by design)", () => {
    expect(positionGroup("Alpha3")).toBeNull();
  });
});

describe("seamOf / seamEndOf", () => {
  it("reads startPosition and endPosition off a step", () => {
    const step = {
      startPosition: "beta5",
      endPosition: null,
    } as StepData;

    expect(seamOf(step)).toBe("beta5");
    expect(seamEndOf(step)).toBeNull();
  });
});
