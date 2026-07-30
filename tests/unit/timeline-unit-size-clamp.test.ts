import { describe, expect, it } from "vitest";
import {
  calculateTimelineUnitSize,
  clampTimelineUnitSizeToHeight,
} from "../../src/lib/shared/create/utils/grid-calculations";

describe("clampTimelineUnitSizeToHeight", () => {
  it("clamps a start-only sequence (one row) to the container height", () => {
    // The Fold-portrait regression: wrapper 293px tall, width-based size 354.
    // With rowCount 1 the tile must fit: (293 - 32 - 0 - 8) / 1 = 253.
    expect(clampTimelineUnitSizeToHeight(354, 293, 1)).toBe(253);
  });

  it("returns the width-based size untouched when height is generous", () => {
    expect(clampTimelineUnitSizeToHeight(354, 900, 1)).toBe(354);
  });

  it("divides the available height across multiple rows", () => {
    // (500 - 32 - 2 - 8) / 3 = 152.66 -> 152
    expect(clampTimelineUnitSizeToHeight(400, 500, 3)).toBe(152);
  });

  it("never clamps below the 48px touch floor", () => {
    expect(clampTimelineUnitSizeToHeight(354, 100, 2)).toBe(48);
  });

  it("passes through when there is no measured height or no rows", () => {
    expect(clampTimelineUnitSizeToHeight(354, 0, 1)).toBe(354);
    expect(clampTimelineUnitSizeToHeight(354, 293, 0)).toBe(354);
  });

  it("integrates with the width-based size the way StepGrid wires it", () => {
    // Start-only on a Fold portrait: container 760 wide, 293 tall, 2 units
    // (narrow-mode floor), one rendered row. The clamped result must be
    // strictly smaller than the wrapper height.
    const widthBased = calculateTimelineUnitSize(760 - 32, 2);
    expect(widthBased).toBeGreaterThan(293);
    const clamped = clampTimelineUnitSizeToHeight(widthBased, 293, 1);
    expect(clamped).toBeLessThanOrEqual(293 - 32 - 8);
  });
});
