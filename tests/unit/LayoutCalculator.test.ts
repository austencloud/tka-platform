import { describe, it, expect } from "vitest";
import { LayoutCalculator } from "../../src/lib/shared/render/services/implementations/LayoutCalculator";

describe("LayoutCalculator", () => {
  const calc = new LayoutCalculator();

  describe("calculateLayout with start row", () => {
    it("returns WITHOUT_START columns + 1 extra row for 16 steps", () => {
      const layout = calc.calculateLayout(16, true);
      expect(layout).toEqual([4, 5]);
    });

    it("returns WITHOUT_START columns + 1 extra row for 8 steps", () => {
      const layout = calc.calculateLayout(8, true);
      expect(layout).toEqual([4, 3]);
    });

    it("returns WITHOUT_START columns + 1 extra row for 12 steps", () => {
      const layout = calc.calculateLayout(12, true);
      expect(layout).toEqual([3, 5]);
    });

    it("returns WITHOUT_START layout unchanged when no start position", () => {
      const layout = calc.calculateLayout(16, false);
      expect(layout).toEqual([4, 4]);
    });
  });

  describe("calculateGalleryAspectRatio with start column", () => {
    it("uses column-based layout for aspect ratio", () => {
      // 16 steps → LAYOUT_WITH_START_COLUMN[16] = [5, 4]
      // AR = columns / (rows + header/footer fraction)
      const ar = calc.calculateGalleryAspectRatio(16);
      expect(ar).toBeCloseTo(5 / (4 + 10 / 21), 3);
    });
  });
});
