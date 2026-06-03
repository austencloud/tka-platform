import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { MandalaPrimitiveRef } from "$lib/features/sticker-lab/domain/sticker-types";
import { createDefaultStickerUnit, createDefaultStickerSheet } from "$lib/features/sticker-lab/domain/sticker-types";
import { STORAGE_KEY_ACTIVE_SHEET, STORAGE_SCHEMA_VERSION, MAX_COPIES_PER_STICKER } from "$lib/features/sticker-lab/domain/sticker-constants";
import type { StickerSheet } from "$lib/features/sticker-lab/domain/sticker-types";
import { goto } from "$app/navigation";

function loadSheet(): StickerSheet {
  const raw = localStorage.getItem(STORAGE_KEY_ACTIVE_SHEET);
  if (!raw) return createDefaultStickerSheet();
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.version === STORAGE_SCHEMA_VERSION && parsed.sheet) {
      return parsed.sheet as StickerSheet;
    }
  } catch { /* ignore */ }
  return createDefaultStickerSheet();
}

function saveSheet(sheet: StickerSheet): void {
  const payload = { version: STORAGE_SCHEMA_VERSION, sheet };
  localStorage.setItem(STORAGE_KEY_ACTIVE_SHEET, JSON.stringify(payload));
}

export function sendToStickerLab(seq: SequenceData): void {
  const ref: MandalaPrimitiveRef = {
    shapeHash: seq.id,
    ultraHash: seq.id,
    sourceLoop: {
      sequenceId: seq.id,
      word: seq.displayName || seq.intendedWord || seq.word || seq.name,
      loopType: seq.loopType ?? "none",
    },
    displayName: seq.displayName || seq.intendedWord || seq.word || seq.name,
  };

  const sheet = loadSheet();
  const existing = sheet.stickers.find((s) => s.primitiveRef.shapeHash === ref.shapeHash);

  if (existing) {
    const clamped = Math.min(MAX_COPIES_PER_STICKER, existing.copies + 1);
    const updated: StickerSheet = {
      ...sheet,
      updatedAt: Date.now(),
      stickers: sheet.stickers.map((s) =>
        s.id === existing.id ? { ...s, copies: clamped } : s
      ),
    };
    saveSheet(updated);
  } else {
    const unit = createDefaultStickerUnit({ primitiveRef: ref });
    const updated: StickerSheet = {
      ...sheet,
      updatedAt: Date.now(),
      stickers: [...sheet.stickers, unit],
    };
    saveSheet(updated);
  }

  goto("/lab?tab=stickers");
}
