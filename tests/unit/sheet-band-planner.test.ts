// tests/unit/sheet-band-planner.test.ts
import { describe, it, expect } from "vitest";
import {
  getSheetPageLayout,
  pageChromePt,
  RUNNING_HEADER_PT,
  TITLE_BLOCK_PT,
} from "$lib/features/write/domain/sheet-page-layout";
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

  it("reserves the title block on page 1 and the running header after", () => {
    expect(pageChromePt(0, true)).toBe(TITLE_BLOCK_PT);
    expect(pageChromePt(0, false)).toBe(0);
    expect(pageChromePt(1, true)).toBe(RUNNING_HEADER_PT);
    expect(pageChromePt(3, false)).toBe(RUNNING_HEADER_PT);
  });
});

import { planBands, type BandPlanInput } from "$lib/features/write/services/sheet-row-planner";
import { bandKey } from "$lib/features/write/domain/types/choreo-sheet";

function seq(id: string, n: number) {
  return { id, steps: Array.from({ length: n }, (_, i) => ({ stepNumber: i + 1, letter: "A" })) } as any;
}

describe("planBands (row-aligned)", () => {
  const geo = getSheetPageLayout({ ...base, orientation: "landscape", showCueRail: true, showNoteStrips: true });

  it("chunks a 12-step sequence into 2 bands of 8 + 4, keyed by rowInSequence", () => {
    const input: BandPlanInput = { sequences: [seq("x", 12)], geo, cues: [], notes: [] };
    const pages = planBands(input);
    const bands = pages.flatMap((p) => p.bands);
    expect(bands.length).toBe(2);
    expect(bands[0].key).toBe(bandKey("x", 0));
    expect(bands[0].cells.length).toBe(8);
    expect(bands[1].key).toBe(bandKey("x", 1));
    expect(bands[1].cells.length).toBe(4); // short last row, NOT cross-padded
    expect(bands[0].isSequenceStart).toBe(true);
    expect(bands[1].isSequenceStart).toBe(false);
  });

  it("each sequence starts a fresh band (no straddling)", () => {
    const input: BandPlanInput = { sequences: [seq("x", 4), seq("y", 4)], geo, cues: [], notes: [] };
    const bands = planBands(input).flatMap((p) => p.bands);
    expect(bands.length).toBe(2);
    expect(bands[0].key).toBe(bandKey("x", 0));
    expect(bands[1].key).toBe(bandKey("y", 0));
    expect(bands[1].isSequenceStart).toBe(true);
  });

  it("resolves cue + notes onto their band by key", () => {
    const cues = [{ band: bandKey("x", 1), timestamp: "0:08", text: "drop" }];
    const notes = [{ id: "n1", band: bandKey("x", 0), count: 5, text: "pack bags" }];
    const bands = planBands({ sequences: [seq("x", 12)], geo, cues, notes }).flatMap((p) => p.bands);
    expect(bands[0].notes).toHaveLength(1);
    expect(bands[0].notes[0].text).toBe("pack bags");
    expect(bands[0].cue).toBeNull();
    expect(bands[1].cue?.text).toBe("drop");
  });

  it("packs bands onto pages by height and overflows to a new page", () => {
    // 40 sequences of 8 steps each = 40 bands; landscape usableHeight fits ~4.
    const many = Array.from({ length: 40 }, (_, i) => seq(`s${i}`, 8));
    const pages = planBands({ sequences: many, geo, cues: [], notes: [] });
    expect(pages.length).toBeGreaterThan(1);
    // every page's summed band height must not exceed usable height
    for (const page of pages) {
      const sum = page.bands.reduce((h, b) => h + b.heightPt, 0);
      expect(sum).toBeLessThanOrEqual(geo.usableHeightPt + 0.01);
    }
  });

  it("leaves room for the page chrome — bands never run past the bottom margin", () => {
    // The regression: page 1 carries a ~186pt title block, and budgeting the
    // whole page for bands pushed the last row off the bottom in portrait.
    const portrait = getSheetPageLayout({ ...base, orientation: "portrait", columns: 8 });
    const many = Array.from({ length: 30 }, (_, i) => seq(`s${i}`, 8));
    const pages = planBands({ sequences: many, geo: portrait, cues: [], notes: [] });

    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) {
      const chrome = pageChromePt(page.pageIndex, true);
      const sum = page.bands.reduce((h, b) => h + b.heightPt, 0);
      expect(chrome).toBeGreaterThan(0);
      expect(sum + chrome).toBeLessThanOrEqual(portrait.usableHeightPt + 0.01);
    }
  });

  it("gives page 1 the extra room back when the title block is off", () => {
    const portrait = getSheetPageLayout({ ...base, orientation: "portrait", columns: 8 });
    const many = Array.from({ length: 30 }, (_, i) => seq(`s${i}`, 8));
    const withTitle = planBands({ sequences: many, geo: portrait, cues: [], notes: [] });
    const without = planBands({
      sequences: many,
      geo: portrait,
      cues: [],
      notes: [],
      showTitleBlock: false,
    });
    expect(without[0]!.bands.length).toBeGreaterThan(withTitle[0]!.bands.length);
  });
});
