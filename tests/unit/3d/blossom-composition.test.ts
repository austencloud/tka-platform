import { describe, expect, it } from "vitest";
import {
  getBlossomRiverBounds,
  getBlossomRiverCenterline,
  getBlossomRiverOutline,
} from "$lib/shared/3d/environments/scenes/cherry-blossom/blossom-water";

/** Plan coordinates of the authored control points, in reflector-local terms. */
const AUTHORED_REACH = [
  [42, -15],
  [-43, -15.8],
] as const;

describe("Blossom measured composition", () => {
  it("maps the authored river into reflector-local coordinates", () => {
    const centerline = getBlossomRiverCenterline();
    const [west, east] = AUTHORED_REACH;

    // The course now continues past both ends of the site, so the authored
    // control points sit inside it rather than at its extremes.
    const westIndex = centerline.findIndex(
      ([x, depth]) =>
        Math.abs(x - west[0]) < 1e-9 && Math.abs(depth - west[1]) < 1e-9
    );
    const eastIndex = centerline.findIndex(
      ([x, depth]) =>
        Math.abs(x - east[0]) < 1e-9 && Math.abs(depth - east[1]) < 1e-9
    );

    expect(westIndex).toBeGreaterThan(0);
    expect(eastIndex).toBeGreaterThan(westIndex);
    // Ten control points resampled at eight subdivisions.
    expect(eastIndex - westIndex).toBe(9 * 8);
  });

  it("lands behind the performers across the authored reach", () => {
    const centerline = getBlossomRiverCenterline();
    const [west, east] = AUTHORED_REACH;
    const westIndex = centerline.findIndex(([x]) => Math.abs(x - west[0]) < 1e-9);
    const eastIndex = centerline.findIndex(([x]) => Math.abs(x - east[0]) < 1e-9);

    const worldDepths = centerline
      .slice(westIndex, eastIndex + 1)
      .map(([, localY]) => -localY);

    expect(Math.min(...worldDepths)).toBeGreaterThan(0);
    expect(Math.max(...worldDepths)).toBeLessThan(20);
  });

  it("spans the whole site rather than stopping inside it", () => {
    const outline = getBlossomRiverOutline();
    const bounds = getBlossomRiverBounds();

    // Two banks over a resampled course, so far denser than the ten authored
    // control points that used to be walked directly.
    expect(outline.length).toBeGreaterThan(120);
    expect(bounds.width).toBeGreaterThan(256);
    expect(bounds.depth).toBeGreaterThan(10);
  });

  it("returns fresh arrays so one scene cannot mutate the shared plan", () => {
    const first = getBlossomRiverOutline();
    first[0]![0] = 999;

    expect(getBlossomRiverOutline()[0]![0]).not.toBe(999);
  });
});
