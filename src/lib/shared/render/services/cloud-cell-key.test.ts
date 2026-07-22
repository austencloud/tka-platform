import { describe, it, expect } from "vitest";
import { canonicalCellKeyString, CANONICAL_CELL_SIZE } from "./cloud-cell-key";
import type { PreviewCellRenderOptions } from "$lib/shared/sequence-viewer/services/preview-cell-renderer";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

const data = {
  letter: "A",
  startPos: "alpha1",
  endPos: "alpha3",
  motions: {
    blue: { motionType: "pro", startLocation: "n", endLocation: "e", turns: 0 },
    red: { motionType: "pro", startLocation: "s", endLocation: "w", turns: 0 },
  },
} as unknown as PictographData;

const base: PreviewCellRenderOptions = { size: 300, bluePropType: undefined };

describe("canonicalCellKeyString", () => {
  it("is independent of display size (size normalized to canonical)", () => {
    const a = canonicalCellKeyString(data, true, { ...base, size: 300 });
    const b = canonicalCellKeyString(data, true, { ...base, size: 640 });
    expect(a).toBe(b);
    expect(a).toContain(String(CANONICAL_CELL_SIZE));
  });

  it("is independent of step-number presence", () => {
    const a = canonicalCellKeyString(data, true, { ...base, showStepNumbers: true });
    const b = canonicalCellKeyString(data, true, { ...base, showStepNumbers: false });
    expect(a).toBe(b);
  });

  it("differs by dark mode and by prop type", () => {
    expect(canonicalCellKeyString(data, true, base)).not.toBe(
      canonicalCellKeyString(data, false, base),
    );
    expect(
      canonicalCellKeyString(data, true, {
        ...base,
        bluePropType: PropType.STAFF,
        redPropType: PropType.POI,
        catDogModeEnabled: true,
      })
    ).not.toBe(
      canonicalCellKeyString(data, true, {
        ...base,
        bluePropType: PropType.FAN,
        redPropType: PropType.POI,
        catDogModeEnabled: true,
      })
    );
  });

  it("normalizes per-device visibility: same hash regardless of showTKA/showTnD/showGrid", () => {
    const a = canonicalCellKeyString(data, true, { ...base, showTKA: true, showTnD: true, showGrid: true });
    const b = canonicalCellKeyString(data, true, { ...base, showTKA: false, showTnD: false, showGrid: false });
    expect(a).toBe(b);
  });
});
