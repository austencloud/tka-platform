import { LocalStickerSheetRepository } from "./services/local-sticker-sheet-repository";
import type { IStickerSheetRepository } from "./services/contracts/IStickerSheetRepository";

let instance: LocalStickerSheetRepository | null = null;

export function getStickerSheetRepository(): IStickerSheetRepository {
  return (instance ??= new LocalStickerSheetRepository());
}
