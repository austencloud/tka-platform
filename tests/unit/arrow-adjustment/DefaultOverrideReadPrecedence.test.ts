import { describe, it, expect, afterEach } from "vitest";
import { ArrowPlacer, setDefaultOverrideResolver } from "$lib/shared/pictograph/arrow/positioning/placement/services/arrow-placer";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { MotionType } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

// Minimal SimpleJsonCache stand-in: returns a fixed box/pro placements map.
const fakeCache = {
  async get(path: string) {
    if (path.includes("box") && path.includes("pro")) {
      return { pro_to_layer1_alpha: { "1.5": [-35, 145] } };
    }
    return {};
  },
} as unknown as import("$lib/shared/pictograph/shared/services/simple-json-cache").SimpleJsonCache;

afterEach(() => setDefaultOverrideResolver(null));

describe("default override read precedence", () => {
  it("returns the static JSON value when no resolver is registered", async () => {
    const placer = new ArrowPlacer(fakeCache);
    const result = await placer.getDefaultAdjustment(
      "pro" as MotionType,
      "pro_to_layer1_alpha",
      "1.5",
      GridMode.BOX,
    );
    expect(result).toEqual({ x: -35, y: 145 });
  });

  it("prefers the resolver value over the static JSON value", async () => {
    const placer = new ArrowPlacer(fakeCache);
    setDefaultOverrideResolver((grid, motion, key, turns, prop) =>
      grid === "box" && motion === "pro" && key === "pro_to_layer1_alpha" && turns === "1.5" && prop === "staff"
        ? [7, 9]
        : null,
    );
    const result = await placer.getDefaultAdjustment(
      "pro" as MotionType,
      "pro_to_layer1_alpha",
      "1.5",
      GridMode.BOX,
    );
    expect(result).toEqual({ x: 7, y: 9 });
  });

  it("falls through to JSON when the resolver returns null", async () => {
    const placer = new ArrowPlacer(fakeCache);
    setDefaultOverrideResolver(() => null);
    const result = await placer.getDefaultAdjustment(
      "pro" as MotionType,
      "pro_to_layer1_alpha",
      "1.5",
      GridMode.BOX,
    );
    expect(result).toEqual({ x: -35, y: 145 });
  });
});
