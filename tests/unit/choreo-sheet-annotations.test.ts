// tests/unit/choreo-sheet-annotations.test.ts
import { describe, it, expect } from "vitest";
import {
  bandKey,
  createEmptyAnnotations,
  DEFAULT_SHEET_LAYOUT,
  createEmptyChoreoSheet,
} from "$lib/features/write/domain/types/choreo-sheet";

describe("choreo-sheet annotations model", () => {
  it("bandKey composes sequenceId + rowInSequence", () => {
    expect(bandKey("abc", 0)).toBe("abc:0");
    expect(bandKey("abc", 2)).toBe("abc:2");
  });

  it("createEmptyAnnotations has empty cues/notes and a header with title block on", () => {
    const a = createEmptyAnnotations();
    expect(a.cues).toEqual([]);
    expect(a.notes).toEqual([]);
    expect(a.header.showTitleBlock).toBe(true);
  });

  it("default layout is flow-packed landscape with rail/strips off (back-compat)", () => {
    expect(DEFAULT_SHEET_LAYOUT.orientation).toBe("landscape");
    expect(DEFAULT_SHEET_LAYOUT.packing).toBe("flow");
    expect(DEFAULT_SHEET_LAYOUT.showCueRail).toBe(false);
    expect(DEFAULT_SHEET_LAYOUT.showNoteStrips).toBe(false);
  });

  it("a new sheet carries empty annotations", () => {
    const sheet = createEmptyChoreoSheet("owner-1");
    expect(sheet.annotations.cues).toEqual([]);
    expect(sheet.annotations.header.showTitleBlock).toBe(true);
  });
});
