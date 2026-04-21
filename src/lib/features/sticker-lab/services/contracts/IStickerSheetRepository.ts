import type { StickerSheet } from "../../domain/sticker-types";

export interface IStickerSheetRepository {
  /** Load the active sheet. Returns null if none has been saved yet. */
  load(): StickerSheet | null;

  /** Persist the active sheet. Overwrites any prior value. */
  save(sheet: StickerSheet): void;

  /** Remove the active sheet from storage. */
  clear(): void;
}
