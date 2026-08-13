import { describe, expect, it } from "vitest";
import {
  blockAllExcept,
  hasSameBlockedPositions,
  toggleBlockedPosition,
} from "$lib/shared/components/position-picker/position-selection";
import { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

const positions = [
  GridPosition.ALPHA1,
  GridPosition.ALPHA3,
  GridPosition.BETA1,
];

describe("position picker selection", () => {
  it("keeps the final enabled position selected", () => {
    const blocked = [GridPosition.ALPHA3, GridPosition.BETA1];

    expect(toggleBlockedPosition(positions, blocked, GridPosition.ALPHA1)).toBe(
      blocked
    );
  });

  it("toggles positions while more than one remains available", () => {
    expect(toggleBlockedPosition(positions, [], GridPosition.ALPHA1)).toEqual([
      GridPosition.ALPHA1,
    ]);
    expect(
      toggleBlockedPosition(
        positions,
        [GridPosition.ALPHA1],
        GridPosition.ALPHA1
      )
    ).toEqual([]);
  });

  it("turns a choose-one tap into one enabled position", () => {
    expect(blockAllExcept(positions, GridPosition.ALPHA3)).toEqual([
      GridPosition.ALPHA1,
      GridPosition.BETA1,
    ]);
  });

  it("matches preset blocklists without depending on order", () => {
    expect(
      hasSameBlockedPositions(
        [GridPosition.BETA1, GridPosition.ALPHA1],
        [GridPosition.ALPHA1, GridPosition.BETA1]
      )
    ).toBe(true);
  });
});
