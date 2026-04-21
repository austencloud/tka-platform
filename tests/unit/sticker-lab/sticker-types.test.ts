import { describe, it, expect } from "vitest";
import {
  createDefaultStickerUnit,
  createDefaultStickerSheet,
  type StickerUnit,
  type StickerSheet,
} from "$lib/features/sticker-lab/domain/sticker-types";

describe("sticker-types default factories", () => {
  it("createDefaultStickerUnit returns a unit with variant=full, background=transparent, copies=1, presentation=pure", () => {
    const unit = createDefaultStickerUnit({
      sourceLoop: { sequenceId: "seq-1", word: "ALPHA", loopType: "rotated-loop" },
    });

    expect(unit.variant).toBe("full");
    expect(unit.background).toBe("transparent");
    expect(unit.copies).toBe(1);
    expect(unit.presentation).toBe("pure");
    expect(unit.size).toBe("3in-round");
    expect(unit.sourceLoop?.sequenceId).toBe("seq-1");
    expect(unit.id).toMatch(/^sticker-[a-z0-9]+$/);
  });

  it("createDefaultStickerUnit accepts sourceLoop=null (Phase 3 chimera hook)", () => {
    const unit = createDefaultStickerUnit({ sourceLoop: null });
    expect(unit.sourceLoop).toBeNull();
  });

  it("createDefaultStickerSheet returns an empty sheet at 8.5x11 with current timestamps", () => {
    const before = Date.now();
    const sheet = createDefaultStickerSheet();
    const after = Date.now();

    expect(sheet.sheetSize).toBe("8.5x11");
    expect(sheet.stickers).toEqual([]);
    expect(sheet.name).toBe("My Sheet");
    expect(sheet.createdAt).toBeGreaterThanOrEqual(before);
    expect(sheet.createdAt).toBeLessThanOrEqual(after);
    expect(sheet.updatedAt).toBe(sheet.createdAt);
    expect(sheet.id).toMatch(/^sheet-[a-z0-9]+$/);
  });
});
