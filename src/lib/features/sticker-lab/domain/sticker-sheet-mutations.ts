import { MAX_COPIES_PER_STICKER } from "./sticker-constants";
import {
  createDefaultStickerUnit,
  type MandalaPrimitiveRef,
  type StickerSheet,
} from "./sticker-types";

/** One owner for adding shapes, whether the request comes from Sticker Lab or Sequence Viewer. */
export function addPrimitiveToSheet(
  sheet: StickerSheet,
  ref: MandalaPrimitiveRef,
  now = Date.now()
): StickerSheet {
  const existing = sheet.stickers.find(
    (sticker) => sticker.primitiveRef.shapeHash === ref.shapeHash
  );

  if (existing) {
    const copies = Math.min(MAX_COPIES_PER_STICKER, existing.copies + 1);
    return {
      ...sheet,
      updatedAt: now,
      stickers: sheet.stickers.map((sticker) =>
        sticker.id === existing.id ? { ...sticker, copies } : sticker
      ),
    };
  }

  return {
    ...sheet,
    updatedAt: now,
    stickers: [
      ...sheet.stickers,
      createDefaultStickerUnit({ primitiveRef: ref }),
    ],
  };
}
