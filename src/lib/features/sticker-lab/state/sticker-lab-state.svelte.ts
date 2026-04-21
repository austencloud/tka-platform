import type {
  LoopRef,
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
import { LocalStickerSheetRepository } from "../services/implementations/LocalStickerSheetRepository";
import type { IStickerSheetRepository } from "../services/contracts/IStickerSheetRepository";

export interface StickerLabState {
  readonly sheet: StickerSheet;
  addLoop(ref: LoopRef): void;
  setVariant(stickerId: string, variant: StickerVariant): void;
  setBackground(stickerId: string, background: StickerBackground): void;
  setCopies(stickerId: string, copies: number): void;
  removeSticker(stickerId: string): void;
  setSheetSize(size: SheetSize): void;
  clearSheet(): void;
}

export function createStickerLabState(
  repository: IStickerSheetRepository = new LocalStickerSheetRepository()
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

    addLoop(ref: LoopRef): void {
      if (sheet.stickers.some((s) => s.sourceLoop?.sequenceId === ref.sequenceId)) return;
      const unit = createDefaultStickerUnit({ sourceLoop: ref });
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
