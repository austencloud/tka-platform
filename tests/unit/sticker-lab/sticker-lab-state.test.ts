import { describe, it, expect, vi } from "vitest";
import { createStickerLabState } from "$lib/features/sticker-lab/state/sticker-lab-state.svelte";
import type { IStickerSheetRepository } from "$lib/features/sticker-lab/services/contracts/IStickerSheetRepository";
import type {
  StickerSheet,
  MandalaPrimitiveRef,
} from "$lib/features/sticker-lab/domain/sticker-types";

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

const refA: MandalaPrimitiveRef = {
  shapeHash: "shape-a",
  ultraHash: "shape-a",
  displayName: "Shape A",
};
const refB: MandalaPrimitiveRef = {
  shapeHash: "shape-b",
  ultraHash: "shape-b",
  displayName: "Shape B",
};

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

  it("addPrimitive appends a new sticker for a new shapeHash", () => {
    const state = createStickerLabState(mockRepo(null));
    state.addPrimitive(refA);
    expect(state.sheet.stickers).toHaveLength(1);
    expect(state.sheet.stickers[0]!.primitiveRef.shapeHash).toBe("shape-a");
    expect(state.sheet.stickers[0]!.variant).toBe("full");
  });

  it("addPrimitive does not duplicate when shapeHash already exists on the sheet", () => {
    const state = createStickerLabState(mockRepo(null));
    state.addPrimitive(refA);
    state.addPrimitive(refA);
    expect(state.sheet.stickers).toHaveLength(1);
  });

  it("addPrimitive increments copies on an existing sticker", () => {
    const state = createStickerLabState(mockRepo(null));
    state.addPrimitive(refA);
    state.addPrimitive(refA); // second call — should increment copies
    expect(state.sheet.stickers[0]!.copies).toBe(2);
  });

  it("addPrimitive copies increment is clamped at MAX_COPIES_PER_STICKER (50)", () => {
    const state = createStickerLabState(mockRepo(null));
    state.addPrimitive(refA);
    // Fast-forward to 50 by directly setting, then try to exceed.
    const id = state.sheet.stickers[0]!.id;
    state.setCopies(id, 50);
    state.addPrimitive(refA);
    expect(state.sheet.stickers[0]!.copies).toBe(50);
  });

  it("addPrimitive adds a second sticker for a different shapeHash", () => {
    const state = createStickerLabState(mockRepo(null));
    state.addPrimitive(refA);
    state.addPrimitive(refB);
    expect(state.sheet.stickers).toHaveLength(2);
  });

  it("setVariant updates the sticker's variant", () => {
    const state = createStickerLabState(mockRepo(null));
    state.addPrimitive(refA);
    const id = state.sheet.stickers[0]!.id;
    state.setVariant(id, "blue");
    expect(state.sheet.stickers[0]!.variant).toBe("blue");
  });

  it("setBackground updates the sticker's background", () => {
    const state = createStickerLabState(mockRepo(null));
    state.addPrimitive(refA);
    const id = state.sheet.stickers[0]!.id;
    state.setBackground(id, "radial-gradient");
    expect(state.sheet.stickers[0]!.background).toBe("radial-gradient");
  });

  it("setCopies clamps to [1, 50]", () => {
    const state = createStickerLabState(mockRepo(null));
    state.addPrimitive(refA);
    const id = state.sheet.stickers[0]!.id;
    state.setCopies(id, 0);
    expect(state.sheet.stickers[0]!.copies).toBe(1);
    state.setCopies(id, 999);
    expect(state.sheet.stickers[0]!.copies).toBe(50);
  });

  it("removeSticker drops the sticker from the sheet", () => {
    const state = createStickerLabState(mockRepo(null));
    state.addPrimitive(refA);
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
    state.addPrimitive(refA);
    state.clearSheet();
    expect(state.sheet.stickers).toEqual([]);
    expect(repo.clear).toHaveBeenCalled();
  });

  it("every mutation persists to the repository", () => {
    const repo = mockRepo(null);
    const state = createStickerLabState(repo);
    state.addPrimitive(refA);
    expect(repo.save).toHaveBeenCalled();
  });
});
