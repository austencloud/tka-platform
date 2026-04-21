import { describe, it, expect, beforeEach, vi } from "vitest";
import { createStickerLabState } from "$lib/features/sticker-lab/state/sticker-lab-state.svelte";
import type { IStickerSheetRepository } from "$lib/features/sticker-lab/services/contracts/IStickerSheetRepository";
import type { StickerSheet } from "$lib/features/sticker-lab/domain/sticker-types";

function mockRepo(initial: StickerSheet | null = null): IStickerSheetRepository {
  let stored = initial;
  return {
    load: vi.fn(() => stored),
    save: vi.fn((s) => {
      stored = s;
    }),
    clear: vi.fn(() => {
      stored = null;
    }),
  };
}

describe("sticker-lab state", () => {
  it("creates a fresh sheet when repository is empty", () => {
    const repo = mockRepo(null);
    const state = createStickerLabState(repo);
    expect(state.sheet.stickers).toEqual([]);
    expect(state.sheet.sheetSize).toBe("8.5x11");
  });

  it("loads an existing sheet from the repository", () => {
    const preexisting: StickerSheet = {
      id: "sheet-1",
      name: "Loaded",
      sheetSize: "13x19",
      stickers: [],
      createdAt: 1,
      updatedAt: 2,
    };
    const repo = mockRepo(preexisting);
    const state = createStickerLabState(repo);
    expect(state.sheet.id).toBe("sheet-1");
    expect(state.sheet.sheetSize).toBe("13x19");
  });

  it("addLoop appends a new sticker with default variant=full", () => {
    const state = createStickerLabState(mockRepo(null));
    state.addLoop({ sequenceId: "seq-1", word: "ALPHA", loopType: "rotated-loop" });
    expect(state.sheet.stickers).toHaveLength(1);
    expect(state.sheet.stickers[0]!.variant).toBe("full");
    expect(state.sheet.stickers[0]!.sourceLoop?.sequenceId).toBe("seq-1");
  });

  it("addLoop is idempotent per sequenceId (no duplicate append)", () => {
    const state = createStickerLabState(mockRepo(null));
    const ref = { sequenceId: "seq-1", word: "ALPHA", loopType: "rotated-loop" };
    state.addLoop(ref);
    state.addLoop(ref);
    expect(state.sheet.stickers).toHaveLength(1);
  });

  it("setVariant updates the sticker's variant", () => {
    const state = createStickerLabState(mockRepo(null));
    state.addLoop({ sequenceId: "seq-1", word: "A", loopType: "t" });
    const id = state.sheet.stickers[0]!.id;
    state.setVariant(id, "blue");
    expect(state.sheet.stickers[0]!.variant).toBe("blue");
  });

  it("setBackground updates the sticker's background", () => {
    const state = createStickerLabState(mockRepo(null));
    state.addLoop({ sequenceId: "seq-1", word: "A", loopType: "t" });
    const id = state.sheet.stickers[0]!.id;
    state.setBackground(id, "radial-gradient");
    expect(state.sheet.stickers[0]!.background).toBe("radial-gradient");
  });

  it("setCopies clamps to [1, 50]", () => {
    const state = createStickerLabState(mockRepo(null));
    state.addLoop({ sequenceId: "seq-1", word: "A", loopType: "t" });
    const id = state.sheet.stickers[0]!.id;
    state.setCopies(id, 0);
    expect(state.sheet.stickers[0]!.copies).toBe(1);
    state.setCopies(id, 999);
    expect(state.sheet.stickers[0]!.copies).toBe(50);
  });

  it("removeSticker drops the sticker from the sheet", () => {
    const state = createStickerLabState(mockRepo(null));
    state.addLoop({ sequenceId: "seq-1", word: "A", loopType: "t" });
    const id = state.sheet.stickers[0]!.id;
    state.removeSticker(id);
    expect(state.sheet.stickers).toHaveLength(0);
  });

  it("setSheetSize updates the sheet size", () => {
    const state = createStickerLabState(mockRepo(null));
    state.setSheetSize("13x19");
    expect(state.sheet.sheetSize).toBe("13x19");
  });

  it("clearSheet produces a fresh empty sheet and calls repo.clear", () => {
    const repo = mockRepo(null);
    const state = createStickerLabState(repo);
    state.addLoop({ sequenceId: "seq-1", word: "A", loopType: "t" });
    state.clearSheet();
    expect(state.sheet.stickers).toEqual([]);
    expect(repo.clear).toHaveBeenCalled();
  });

  it("every mutation persists to the repository", () => {
    const repo = mockRepo(null);
    const state = createStickerLabState(repo);
    state.addLoop({ sequenceId: "seq-1", word: "A", loopType: "t" });
    expect(repo.save).toHaveBeenCalled();
  });
});
