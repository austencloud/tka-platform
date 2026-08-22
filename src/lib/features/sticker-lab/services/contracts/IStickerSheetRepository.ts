import type { StickerSheet } from "../../domain/sticker-types";

export interface IStickerSheetRepository {
  load(): StickerSheet | null;
  save(sheet: StickerSheet): void;
  clear(): void;
}
