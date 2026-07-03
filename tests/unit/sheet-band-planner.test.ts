// tests/unit/sheet-band-planner.test.ts
import { describe, it, expect } from "vitest";
import { getSheetPageLayout } from "$lib/features/write/domain/sheet-page-layout";
import { DEFAULT_SHEET_LAYOUT } from "$lib/features/write/domain/types/choreo-sheet";

const base = { ...DEFAULT_SHEET_LAYOUT };

describe("sheet geometry — orientation + annotation bands", () => {
  it("landscape is 792x612, portrait is 612x792", () => {
    const land = getSheetPageLayout({ ...base, orientation: "landscape" });
    const port = getSheetPageLayout({ ...base, orientation: "portrait" });
    expect([land.pageWidthPt, land.pageHeightPt]).toEqual([792, 612]);
    expect([port.pageWidthPt, port.pageHeightPt]).toEqual([612, 792]);
  });

  it("cue rail reserves left width only when showCueRail is on", () => {
    const off = getSheetPageLayout({ ...base, showCueRail: false });
    const on = getSheetPageLayout({ ...base, showCueRail: true });
    expect(off.railWidthPt).toBe(0);
    expect(on.railWidthPt).toBeGreaterThan(40);
    // rail eats into cell width
    expect(on.cellSizePt).toBeLessThan(off.cellSizePt);
  });

  it("note strips add base strip height only when showNoteStrips is on", () => {
    const off = getSheetPageLayout({ ...base, showNoteStrips: false });
    const on = getSheetPageLayout({ ...base, showNoteStrips: true });
    expect(off.stripBaseHeightPt).toBe(0);
    expect(on.stripBaseHeightPt).toBeCloseTo(on.cellSizePt * 0.5, 5);
  });

  it("exposes usableHeightPt for height-packed pagination", () => {
    const geo = getSheetPageLayout(base);
    expect(geo.usableHeightPt).toBeGreaterThan(0);
    expect(geo.usableHeightPt).toBeLessThan(geo.pageHeightPt);
  });
});
