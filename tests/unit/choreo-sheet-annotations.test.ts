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

// ── State-factory annotation editing ─────────────────────────────────────────
import { createChoreoSheetState } from "$lib/features/write/state/choreo-sheet-state.svelte";

function makeState() {
  return createChoreoSheetState({
    loadSequence: async () => null,
  });
}

describe("annotation editing on the state factory", () => {
  it("setHeader patches header fields and marks dirty", () => {
    const s = makeState();
    expect(s.isDirty).toBe(false);
    s.setHeader({ songName: "1940" });
    expect(s.sheet.annotations.header.songName).toBe("1940");
    expect(s.isDirty).toBe(true);
  });

  it("addNote then setNote then removeNote round-trips", () => {
    const s = makeState();
    const id = s.addNote("x:0", 5);
    expect(s.sheet.annotations.notes).toHaveLength(1);
    s.setNote(id, { text: "pack bags" });
    expect(s.sheet.annotations.notes[0].text).toBe("pack bags");
    s.removeNote(id);
    expect(s.sheet.annotations.notes).toHaveLength(0);
  });

  it("setCue upserts a cue by band key", () => {
    const s = makeState();
    s.setCue("x:1", { timestamp: "0:08", text: "drop" });
    expect(s.sheet.annotations.cues).toHaveLength(1);
    s.setCue("x:1", { text: "drop harder" });
    expect(s.sheet.annotations.cues).toHaveLength(1);
    expect(s.sheet.annotations.cues[0].text).toBe("drop harder");
    expect(s.sheet.annotations.cues[0].timestamp).toBe("0:08");
  });
});
