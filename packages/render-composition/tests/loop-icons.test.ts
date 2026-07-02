import { describe, it, expect } from "vitest";
import { LOOP_ICON_COLORS } from "../src/loop-icons.js";

describe("loop-icons", () => {
  it("has colors for all 6 components plus freeform", () => {
    expect(Object.keys(LOOP_ICON_COLORS)).toHaveLength(7);
    expect(LOOP_ICON_COLORS.rotated).toBe("#36c3ff");
    expect(LOOP_ICON_COLORS.mirrored).toBe("#6F2DA8");
    expect(LOOP_ICON_COLORS.flipped).toBe("#e91e63");
    expect(LOOP_ICON_COLORS.swapped).toBe("#2ecc71");
    expect(LOOP_ICON_COLORS.inverted).toBe("#eb7d00");
    expect(LOOP_ICON_COLORS.rewound).toBe("#00bcd4");
    expect(LOOP_ICON_COLORS.freeform).toBe("#9e9e9e");
  });
});
