import { describe, expect, it } from "vitest";
import { calculateGlyphOverlayFrame } from "./glyph-overlay-frame";

describe("calculateGlyphOverlayFrame", () => {
  it("keeps the canonical pictograph frame unchanged", () => {
    expect(calculateGlyphOverlayFrame("pictograph", 1600, 900)).toEqual({
      width: 950,
      height: 950,
      centerX: 475,
      rightOffset: 0,
      bottomOffset: 0,
    });
  });

  it("expands a landscape stage horizontally without changing its height", () => {
    expect(calculateGlyphOverlayFrame("stage", 1600, 900)).toEqual({
      width: 950 * (1600 / 900),
      height: 950,
      centerX: (950 * (1600 / 900)) / 2,
      rightOffset: 950 * (1600 / 900) - 950,
      bottomOffset: 0,
    });
  });

  it("expands a portrait stage vertically without changing its width", () => {
    expect(calculateGlyphOverlayFrame("stage", 900, 1600)).toEqual({
      width: 950,
      height: 950 / (900 / 1600),
      centerX: 475,
      rightOffset: 0,
      bottomOffset: 950 / (900 / 1600) - 950,
    });
  });

  it("falls back to the square frame before layout has a measurable size", () => {
    expect(calculateGlyphOverlayFrame("stage", 0, 0)).toEqual({
      width: 950,
      height: 950,
      centerX: 475,
      rightOffset: 0,
      bottomOffset: 0,
    });
  });
});
