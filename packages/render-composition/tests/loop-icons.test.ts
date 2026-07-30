import { describe, it, expect } from "vitest";
import {
  getReflectionIconTransform,
  LOOP_ICON_COLORS,
} from "../src/loop-icons.js";

describe("loop-icons", () => {
  it("has colors for all 6 components plus freeform", () => {
    expect(Object.keys(LOOP_ICON_COLORS)).toHaveLength(7);
    expect(LOOP_ICON_COLORS.rotated).toBe("#36c3ff");
    expect(LOOP_ICON_COLORS.mirrored).toBe("#6F2DA8");
    expect(LOOP_ICON_COLORS.flipped).toBe("#6F2DA8");
    expect(LOOP_ICON_COLORS.swapped).toBe("#2ecc71");
    expect(LOOP_ICON_COLORS.inverted).toBe("#eb7d00");
    expect(LOOP_ICON_COLORS.rewound).toBe("#00bcd4");
    expect(LOOP_ICON_COLORS.freeform).toBe("#9e9e9e");
  });

  it.each([
    ["mirrored", undefined, "north-south", 0, 1],
    ["flipped", undefined, "east-west", 90, 1],
    ["mirrored", "northeast-southwest", "northeast-southwest", 45, Math.SQRT1_2],
    ["mirrored", "northwest-southeast", "northwest-southeast", -45, Math.SQRT1_2],
  ] as const)(
    "maps %s with axis %s to the correct Reflection glyph transform",
    (component, axis, expectedAxis, rotationDegrees, scale) => {
      expect(getReflectionIconTransform(component, axis)).toEqual({
        axis: expectedAxis,
        rotationDegrees,
        scale,
      });
    }
  );
});
