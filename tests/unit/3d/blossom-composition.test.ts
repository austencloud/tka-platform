import { describe, expect, it } from "vitest";
import {
  getBlossomRiverBounds,
  getBlossomRiverCenterline,
  getBlossomRiverOutline,
  getBlossomRiverShoreline,
} from "$lib/shared/3d/environments/scenes/cherry-blossom/blossom-water";

describe("Blossom crescent pond coordinates", () => {
  it("places the water behind the performance deck after reflector rotation", () => {
    const bounds = getBlossomRiverBounds();
    const world = getBlossomRiverOutline().map(([x, y]) => [
      x + bounds.centerX,
      -y + bounds.centerZ,
    ]);
    expect(Math.min(...world.map(([, depth]) => depth!))).toBeCloseTo(5.6, 5);
    expect(Math.max(...world.map(([x]) => x!))).toBeCloseTo(27, 5);
    expect(Math.min(...world.map(([x]) => x!))).toBeCloseTo(-27, 5);
    expect(
      Math.min(...getBlossomRiverCenterline().map(([, y]) => -y))
    ).toBeGreaterThan(5.6);
  });

  it("preserves both narrow pond tips in the fixed shader shoreline budget", () => {
    const outline = getBlossomRiverOutline();
    const shore = getBlossomRiverShoreline();
    expect(shore).toHaveLength(32);
    for (const edge of [Math.min, Math.max]) {
      expect(edge(...shore.map(([x]) => x))).toBe(
        edge(...outline.map(([x]) => x))
      );
    }
    expect(
      shore.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
    ).toBe(true);
  });

  it("returns fresh arrays so one scene cannot corrupt another scene's water", () => {
    for (const read of [
      getBlossomRiverOutline,
      getBlossomRiverShoreline,
      getBlossomRiverCenterline,
    ]) {
      const expected = read()[0]![0];
      read()[0]![0] = 999;
      expect(read()[0]![0]).toBe(expected);
    }
  });
});
