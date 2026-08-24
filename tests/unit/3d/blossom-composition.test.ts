import { describe, expect, it } from "vitest";
import {
  getBlossomRiverBounds,
  getBlossomRiverCenterline,
  getBlossomRiverOutline,
} from "$lib/shared/3d/environments/scenes/cherry-blossom/blossom-water";

describe("Blossom measured composition", () => {
  it("maps the preserved review river into reflector-local coordinates", () => {
    const centerline = getBlossomRiverCenterline();

    expect(centerline).toHaveLength(10);
    expect(centerline[0]).toEqual([42, -15]);
    expect(centerline.at(-1)).toEqual([-43, -15.8]);
  });

  it("lands behind the performers after the reflector lies flat", () => {
    const worldDepths = getBlossomRiverCenterline().map(
      ([, localY]) => -localY
    );

    expect(Math.min(...worldDepths)).toBeGreaterThan(0);
    expect(worldDepths).toEqual([
      15, 17.4, 16.2, 15.4, 14.5, 16.2, 17.3, 15.5, 17.2, 15.8,
    ]);
  });

  it("keeps the rejected review build measurable without mutating it", () => {
    const outline = getBlossomRiverOutline();
    const bounds = getBlossomRiverBounds();

    expect(outline).toHaveLength(20);
    expect(bounds.width).toBeGreaterThan(80);
    expect(bounds.width).toBeLessThan(90);
    expect(bounds.depth).toBeGreaterThan(10);
    expect(bounds.depth).toBeLessThan(13);
  });

  it("returns fresh arrays so one scene cannot mutate the shared plan", () => {
    const first = getBlossomRiverOutline();
    first[0]![0] = 999;

    expect(getBlossomRiverOutline()[0]![0]).not.toBe(999);
  });
});
