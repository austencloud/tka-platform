import type { StickerSheet } from "../../domain/sticker-types";
import type { MandalaPaths } from "$lib/shared/mandala/domain/mandala-types";

export interface StickerMandalaLookup {
  /** Return pre-computed MandalaPaths for a primitive key (shapeHash in v2). */
  getPaths(primitiveKey: string): MandalaPaths | null;
}

export interface IStickerSheetPdfExporter {
  export(sheet: StickerSheet, lookup: StickerMandalaLookup): Promise<Uint8Array>;
}
