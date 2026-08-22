import type { StickerSheet, StickerUnit } from "../domain/sticker-types";
import {
  STORAGE_KEY_ACTIVE_SHEET,
  STORAGE_SCHEMA_VERSION,
} from "../domain/sticker-constants";
import type { IStickerSheetRepository } from "./contracts/IStickerSheetRepository";
/** v1 stored payload shape (before MandalaPrimitiveRef). */
interface StoredPayloadV1 {
  version: 1;
  sheet: {
    id: string;
    name: string;
    sheetSize: string;
    stickers: Array<{
      id: string;
      sourceLoop?: {
        sequenceId: string;
        word: string;
        loopType: string;
      } | null;
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

interface StoredPrimitiveRefV2 {
  shapeHash: string;
  ultraHash: string;
  sourceLoop?: { sequenceId: string; word: string; loopType: string } | null;
  displayName?: string;
}

interface StoredPayloadV2 {
  version: 2;
  sheet: Omit<StickerSheet, "stickers"> & {
    stickers: Array<
      Omit<StickerUnit, "primitiveRef"> & {
        primitiveRef: StoredPrimitiveRefV2;
      }
    >;
  };
}

interface StoredPayload {
  version: 3;
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
    let payload: { version: number; sheet: unknown } = parsed;

    // Migration chain.
    if (payload.version === 1) {
      payload = migrateV1toV2(payload as unknown as StoredPayloadV1);
    }

    if (payload.version === 2) {
      payload = migrateV2toV3(payload as unknown as StoredPayloadV2);
    }

    // Reject unknown future versions.
    if ((payload as StoredPayload).version !== STORAGE_SCHEMA_VERSION)
      return null;

    return (payload as StoredPayload).sheet;
  }

  save(sheet: StickerSheet): void {
    const payload: StoredPayload = { version: STORAGE_SCHEMA_VERSION, sheet };
    this.storage.setItem(STORAGE_KEY_ACTIVE_SHEET, JSON.stringify(payload));
  }

  clear(): void {
    this.storage.removeItem(STORAGE_KEY_ACTIVE_SHEET);
  }
}

function migrateV1toV2(payload: StoredPayloadV1): StoredPayloadV2 {
  const migrated: StoredPayloadV2["sheet"]["stickers"] =
    payload.sheet.stickers.map((raw) => {
      const sourceLoop = raw.sourceLoop ?? null;
      return {
        id: raw.id,
        primitiveRef: {
          // v2 used the sequence ID as a temporary shape identity. The next
          // migration marks that proxy so Sticker Lab can upgrade it when the
          // representative sequence is available.
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

function migrateV2toV3(payload: StoredPayloadV2): StoredPayload {
  const stickers: StickerUnit[] = payload.sheet.stickers.map((sticker) => {
    const ref = sticker.primitiveRef;
    return {
      ...sticker,
      primitiveRef: {
        ...ref,
        identityKind: "sequence-proxy-v1",
        representativeSequenceId: ref.sourceLoop?.sequenceId ?? ref.shapeHash,
      },
    };
  });

  return {
    version: 3,
    sheet: {
      ...payload.sheet,
      stickers,
    },
  };
}

function isStoredPayload(
  value: unknown
): value is { version: number; sheet: unknown } {
  return (
    typeof value === "object" &&
    value !== null &&
    "version" in value &&
    "sheet" in value &&
    typeof (value as Record<string, unknown>).version === "number"
  );
}
