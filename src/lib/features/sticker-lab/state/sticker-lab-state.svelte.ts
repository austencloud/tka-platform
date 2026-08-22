import type {
  MandalaPrimitiveRef,
  StickerBackground,
  StickerSheet,
  StickerVariant,
  SheetSize,
} from "../domain/sticker-types";
import { createDefaultStickerSheet } from "../domain/sticker-types";
import { MAX_COPIES_PER_STICKER } from "../domain/sticker-constants";
import { addPrimitiveToSheet } from "../domain/sticker-sheet-mutations";
import type { IStickerPrimitiveMigrator } from "../services/contracts/IStickerPrimitiveMigrator";
import type { IStickerSheetRepository } from "../services/contracts/IStickerSheetRepository";

export interface StickerLabState {
  readonly sheet: StickerSheet;
  addPrimitive(ref: MandalaPrimitiveRef): void;
  migrateLegacyPrimitiveIdentities(): Promise<void>;
  setVariant(stickerId: string, variant: StickerVariant): void;
  setBackground(stickerId: string, background: StickerBackground): void;
  setCopies(stickerId: string, copies: number): void;
  removeSticker(stickerId: string): void;
  setSheetSize(size: SheetSize): void;
  clearSheet(): void;
}

export function createStickerLabState(
  repository: IStickerSheetRepository,
  primitiveMigrator: IStickerPrimitiveMigrator
): StickerLabState {
  let sheet = $state<StickerSheet>(
    repository.load() ?? createDefaultStickerSheet()
  );

  function mutate(updater: (s: StickerSheet) => StickerSheet): void {
    sheet = { ...updater(sheet), updatedAt: Date.now() };
    repository.save(sheet);
  }

  return {
    get sheet() {
      return sheet;
    },

    addPrimitive(ref: MandalaPrimitiveRef): void {
      sheet = addPrimitiveToSheet(sheet, ref);
      repository.save(sheet);
    },

    async migrateLegacyPrimitiveIdentities(): Promise<void> {
      const legacyStickers = sheet.stickers.filter(
        (sticker) => sticker.primitiveRef.identityKind === "sequence-proxy-v1"
      );
      for (const sticker of legacyStickers) {
        try {
          const resolved = await primitiveMigrator.resolveGeometryIdentity(
            sticker.primitiveRef
          );
          if (!resolved || resolved.identityKind !== "geometry-v1") continue;
          mutate((current) => ({
            ...current,
            stickers: current.stickers.map((candidate) =>
              candidate.id === sticker.id
                ? { ...candidate, primitiveRef: resolved }
                : candidate
            ),
          }));
        } catch (error) {
          // A legacy sticker still renders through its representative sequence.
          // Keep the saved reference intact so a temporary catalog failure never
          // turns into destructive migration.
          console.warn(`[sticker-lab] couldn't upgrade ${sticker.id}:`, error);
        }
      }
    },

    setVariant(stickerId: string, variant: StickerVariant): void {
      mutate((s) => ({
        ...s,
        stickers: s.stickers.map((x) =>
          x.id === stickerId ? { ...x, variant } : x
        ),
      }));
    },

    setBackground(stickerId: string, background: StickerBackground): void {
      mutate((s) => ({
        ...s,
        stickers: s.stickers.map((x) =>
          x.id === stickerId ? { ...x, background } : x
        ),
      }));
    },

    setCopies(stickerId: string, copies: number): void {
      const clamped = Math.max(
        1,
        Math.min(MAX_COPIES_PER_STICKER, Math.floor(copies))
      );
      mutate((s) => ({
        ...s,
        stickers: s.stickers.map((x) =>
          x.id === stickerId ? { ...x, copies: clamped } : x
        ),
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
