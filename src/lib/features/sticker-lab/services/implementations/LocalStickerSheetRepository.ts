import type { StickerSheet } from "../../domain/sticker-types";
import {
  STORAGE_KEY_ACTIVE_SHEET,
  STORAGE_SCHEMA_VERSION,
} from "../../domain/sticker-constants";
import type { IStickerSheetRepository } from "../contracts/IStickerSheetRepository";

interface StoredPayload {
  version: number;
  sheet: StickerSheet;
}

export class LocalStickerSheetRepository implements IStickerSheetRepository {
  constructor(private readonly storage: Storage = globalThis.localStorage) {}

  load(): StickerSheet | null {
    const raw = this.storage.getItem(STORAGE_KEY_ACTIVE_SHEET);
    if (!raw) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }

    if (!isStoredPayload(parsed)) return null;
    if (parsed.version !== STORAGE_SCHEMA_VERSION) return null;

    return parsed.sheet;
  }

  save(sheet: StickerSheet): void {
    const payload: StoredPayload = {
      version: STORAGE_SCHEMA_VERSION,
      sheet,
    };
    this.storage.setItem(STORAGE_KEY_ACTIVE_SHEET, JSON.stringify(payload));
  }

  clear(): void {
    this.storage.removeItem(STORAGE_KEY_ACTIVE_SHEET);
  }
}

function isStoredPayload(value: unknown): value is StoredPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    "version" in value &&
    "sheet" in value &&
    typeof (value as Record<string, unknown>).version === "number"
  );
}
