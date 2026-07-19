import { describe, it, expect } from "vitest";
import { FAMILY_BY_MODE } from "$lib/shared/shape-matrix/services/build-mode-realizations";
import { MODE_ORDER } from "$lib/shared/shape-matrix/services/shape-matrix-realizations";
import { TND_BY_FAMILY } from "$lib/features/choreo-card/domain/tnd-element";
import { alignScale } from "$lib/shared/shape-matrix/services/mandala-hero";
import {
  MANDALA_GRID_RADIUS,
  ENGINE_GRID_RADIUS,
} from "$lib/shared/mandala/domain/mandala-constants";

describe("elemental drill mode mapping", () => {
  it("maps every VTG mode to a distinct TnD element", () => {
    const elements = MODE_ORDER.map((m) => {
      const family = FAMILY_BY_MODE[m];
      const el = TND_BY_FAMILY[family];
      expect(el, `mode ${m} → family ${family}`).toBeDefined();
      return el.element;
    });
    expect(new Set(elements).size).toBe(6);
    expect(elements).toEqual(["water", "earth", "sun", "fire", "air", "moon"]);
  });
});

describe("mandala hero alignment", () => {
  it("matches the bake path's alignment formula (contract with render-mandala-overlay-layer)", () => {
    const clubTipDx = 130;
    const tipReach = (clubTipDx * MANDALA_GRID_RADIUS) / ENGINE_GRID_RADIUS;
    const maxExtent = MANDALA_GRID_RADIUS + tipReach;
    const mandalaHandFrac = MANDALA_GRID_RADIUS / (2 * maxExtent * 1.05);
    const expected = 150 / 950 / mandalaHandFrac;
    expect(alignScale(clubTipDx)).toBeCloseTo(expected, 10);
  });
});
