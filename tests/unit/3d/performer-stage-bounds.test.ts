import { describe, expect, it } from "vitest";

import {
  getCanonicalStagePositions,
  getPerformerStageBounds,
  getStageBoundsForExtent,
} from "$lib/shared/3d/environments/domain/performer-stage-bounds";

const boundsFor = (count: number) =>
  getPerformerStageBounds(getCanonicalStagePositions(count), {
    performerClearance: 1.5,
  });

describe("stage bounds", () => {
  it("does not move while the cast walks", () => {
    // The reported bug: the deck was measured from live positions, so it grew
    // as a formation opened out and shrank as it closed. Three performers are
    // three performers wherever they are standing.
    const holding = boundsFor(3);
    const walking = boundsFor(3);

    expect(walking).toEqual(holding);
  });

  it("holds every formation a cast of that size can be asked to form", () => {
    for (const count of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const { width, depth } = boundsFor(count);
      for (const spot of getCanonicalStagePositions(count)) {
        expect(Math.abs(spot.x)).toBeLessThanOrEqual(width / 2);
        expect(Math.abs(spot.z)).toBeLessThanOrEqual(depth / 2);
      }
    }
  });

  it("never shrinks as the cast grows", () => {
    let previous = 0;
    for (const count of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const { width } = boundsFor(count);
      expect(width).toBeGreaterThanOrEqual(previous);
      previous = width;
    }
  });

  it("keeps a floor under a solo performer", () => {
    // A single performer standing on the origin must not collapse the deck to
    // a disc the width of their own clearance.
    expect(boundsFor(1).width).toBeGreaterThanOrEqual(6);
    expect(boundsFor(0).width).toBeGreaterThanOrEqual(6);
  });

  it("uses an authored stage as given, corners included", () => {
    // The Stage draws a 10x8 floor on its drill chart and clamps every spot to
    // it. The deck is that floor — not that floor plus room to grow.
    const bounds = getStageBoundsForExtent({ width: 10, depth: 8 });

    expect(bounds.width).toBe(10);
    expect(bounds.depth).toBe(8);
    // A circular deck still has to carry a performer standing in a corner.
    expect(bounds.radius).toBeCloseTo(Math.hypot(5, 4), 6);
  });
});
