import { describe, it, expect } from "vitest";
import { positionGroup } from "$lib/shared/combination/services/position-groups";
import { GridPosition, GridPositionGroup } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

describe("positionGroup", () => {
  it("extracts the family from a GridPosition", () => {
    expect(positionGroup(GridPosition.ALPHA3)).toBe(GridPositionGroup.ALPHA);
    expect(positionGroup(GridPosition.BETA5)).toBe(GridPositionGroup.BETA);
    expect(positionGroup("gamma11" as GridPosition)).toBe(GridPositionGroup.GAMMA);
  });
  it("returns null for unknown strings", () => {
    expect(positionGroup("nonsense9" as GridPosition)).toBeNull();
  });
});
