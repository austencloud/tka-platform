/**
 * Override-migration parity gate — enumerator portion.
 *
 * Proves enumerateVariationArrows() yields one (PictographData, arrowColor)
 * pair per present motion, across diamond + box, carrying the right color.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import type { PictographData } from "../../../src/lib/shared/pictograph/shared/domain/models/PictographData";
import { GridMode } from "../../../src/lib/shared/pictograph/grid/domain/enums/grid-enums";

const getAllPictographVariations = vi.fn();

vi.mock(
  "../../../src/lib/shared/pictograph/tka-glyph/services/letter-query-handler",
  () => ({
    letterQueryHandler: {
      getAllPictographVariations: (gridMode: GridMode) =>
        getAllPictographVariations(gridMode),
    },
  })
);

// Imported after the mock is registered so it binds to the mocked singleton.
import { enumerateVariationArrows } from "../../../src/lib/features/admin/override-migration/services/variation-enumerator";

// Diamond fixture: letter P with BOTH motions present.
const diamondP = {
  letter: "P",
  motions: {
    blue: { motionType: "pro" },
    red: { motionType: "anti" },
  },
} as unknown as PictographData;

// Box fixture: letter I with a single (blue-only) motion present.
const boxI = {
  letter: "I",
  motions: {
    blue: { motionType: "pro" },
  },
} as unknown as PictographData;

describe("enumerateVariationArrows", () => {
  beforeEach(() => {
    getAllPictographVariations.mockReset();
    getAllPictographVariations.mockImplementation((gridMode: GridMode) =>
      Promise.resolve(gridMode === GridMode.DIAMOND ? [diamondP] : [boxI])
    );
  });

  it("loads both grid modes", async () => {
    await enumerateVariationArrows();
    expect(getAllPictographVariations).toHaveBeenCalledWith(GridMode.DIAMOND);
    expect(getAllPictographVariations).toHaveBeenCalledWith(GridMode.BOX);
  });

  it("yields one entry per present motion", async () => {
    const result = await enumerateVariationArrows();
    // P has blue+red (2) + I has blue-only (1) = 3 entries total.
    expect(result).toHaveLength(3);
  });

  it("carries the correct arrowColor per motion", async () => {
    const result = await enumerateVariationArrows();

    const pEntries = result.filter((e) => e.pictographData.letter === "P");
    expect(pEntries.map((e) => e.arrowColor).sort()).toEqual(["blue", "red"]);

    const iEntries = result.filter((e) => e.pictographData.letter === "I");
    expect(iEntries).toHaveLength(1);
    expect(iEntries[0].arrowColor).toBe("blue");
  });

  it("includes the known letter P", async () => {
    const result = await enumerateVariationArrows();
    expect(result.some((e) => e.pictographData.letter === "P")).toBe(true);
  });
});
