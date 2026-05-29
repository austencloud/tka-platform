import type {
  MandalaPrimitiveRef,
  StickerBackground,
  StickerSheet,
  StickerVariant,
  SheetSize,
} from "../domain/sticker-types";
import {
  createDefaultStickerSheet,
  createDefaultStickerUnit,
} from "../domain/sticker-types";
import { MAX_COPIES_PER_STICKER } from "../domain/sticker-constants";
import { LocalStickerSheetRepository } from "../services/local-sticker-sheet-repository";

export interface StickerLabState {
  readonly sheet: StickerSheet;
  addPrimitive(ref: MandalaPrimitiveRef): void;
  setVariant(stickerId: string, variant: StickerVariant): void;
  setBackground(stickerId: string, background: StickerBackground): void;
  setCopies(stickerId: string, copies: number): void;
  removeSticker(stickerId: string): void;
  setSheetSize(size: SheetSize): void;
  clearSheet(): void;
}

export function createStickerLabState(
  repository: LocalStickerSheetRepository = new LocalStickerSheetRepository()
): StickerLabState {
  let sheet = $state<StickerSheet>(repository.load() ?? createDefaultStickerSheet());

  function mutate(updater: (s: StickerSheet) => StickerSheet): void {
    sheet = { ...updater(sheet), updatedAt: Date.now() };
    repository.save(sheet);
  }

  return {
    get sheet() {
      return sheet;
    },

    addPrimitive(ref: MandalaPrimitiveRef): void {
      // Deduplicate by shapeHash - one shape tile per sheet entry.
      const existing = sheet.stickers.find(
        (s) => s.primitiveRef.shapeHash === ref.shapeHash
      );
      if (existing) {
        // Increment copies on existing entry rather than adding a duplicate unit.
        const clamped = Math.min(MAX_COPIES_PER_STICKER, existing.copies + 1);
        mutate((s) => ({
          ...s,
          stickers: s.stickers.map((x) =>
            x.id === existing.id ? { ...x, copies: clamped } : x
          ),
        }));
        return;
      }
      const unit = createDefaultStickerUnit({ primitiveRef: ref });
      mutate((s) => ({ ...s, stickers: [...s.stickers, unit] }));
    },

    setVariant(stickerId: string, variant: StickerVariant): void {
      mutate((s) => ({
        ...s,
        stickers: s.stickers.map((x) => (x.id === stickerId ? { ...x, variant } : x)),
      }));
    },

    setBackground(stickerId: string, background: StickerBackground): void {
      mutate((s) => ({
        ...s,
        stickers: s.stickers.map((x) => (x.id === stickerId ? { ...x, background } : x)),
      }));
    },

    setCopies(stickerId: string, copies: number): void {
      const clamped = Math.max(1, Math.min(MAX_COPIES_PER_STICKER, Math.floor(copies)));
      mutate((s) => ({
        ...s,
        stickers: s.stickers.map((x) => (x.id === stickerId ? { ...x, copies: clamped } : x)),
      }));
    },

    removeSticker(stickerId: string): void {
      mutate((s) => ({
        ...s,
        stickers: s.stickers.filter((x) => x.id !== stickerId),
      }));
    },

    setSheetSize(size: SheetSize): void {
      mutate((s) => ({ ...s, sheetSize: size }));
    },

    clearSheet(): void {
      repository.clear();
      sheet = createDefaultStickerSheet();
    },
  };
}
