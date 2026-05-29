import type { StickerSheet, StickerUnit } from "../domain/sticker-types";
import {
  STORAGE_KEY_ACTIVE_SHEET,
  STORAGE_SCHEMA_VERSION,
} from "../domain/sticker-constants";
/** v1 stored payload shape (before MandalaPrimitiveRef). */
interface StoredPayloadV1 {
  version: 1;
  sheet: {
    id: string;
    name: string;
    sheetSize: string;
    stickers: Array<{
      id: string;
      sourceLoop?: { sequenceId: string; word: string; loopType: string } | null;
      variant: string;
      size: string;
      background: string;
      copies: number;
      presentation: string;
    }>;
    createdAt: number;
    updatedAt: number;
  };
}

interface StoredPayload {
  version: number;
  sheet: StickerSheet;
}

export class LocalStickerSheetRepository {
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

    // Migration chain.
    if (parsed.version === 1) {
      parsed = migrateV1toV2(parsed as unknown as StoredPayloadV1);
    }

    // Reject unknown future versions.
    if ((parsed as StoredPayload).version !== STORAGE_SCHEMA_VERSION) return null;

    return (parsed as StoredPayload).sheet;
  }

  save(sheet: StickerSheet): void {
    const payload: StoredPayload = { version: STORAGE_SCHEMA_VERSION, sheet };
    this.storage.setItem(STORAGE_KEY_ACTIVE_SHEET, JSON.stringify(payload));
  }

  clear(): void {
    this.storage.removeItem(STORAGE_KEY_ACTIVE_SHEET);
  }
}

function migrateV1toV2(payload: StoredPayloadV1): StoredPayload {
  const migrated: StickerUnit[] = payload.sheet.stickers.map((raw) => {
    const sourceLoop = raw.sourceLoop ?? null;
    return {
      id: raw.id,
      primitiveRef: {
        // Stage A proxy: sequenceId becomes the shapeHash placeholder.
        // When Stage B registry lands, these will be recalculated from geometry.
        shapeHash: sourceLoop?.sequenceId ?? `legacy-${raw.id}`,
        ultraHash: sourceLoop?.sequenceId ?? `legacy-${raw.id}`,
        sourceLoop,
        displayName: sourceLoop?.word ?? "Imported sticker",
      },
      sourceLoop, // deprecated annotation retained for audit trail
      variant: raw.variant as StickerUnit["variant"],
      size: raw.size as StickerUnit["size"],
      background: raw.background as StickerUnit["background"],
      copies: raw.copies,
      presentation: raw.presentation as StickerUnit["presentation"],
    };
  });

  return {
    version: 2,
    sheet: {
      ...payload.sheet,
      sheetSize: payload.sheet.sheetSize as StickerSheet["sheetSize"],
      stickers: migrated,
    },
  };
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
