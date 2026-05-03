/**
 * Co-exported types from retired interface contracts.
 */

import type { StickerSheet } from "../../domain/sticker-types";
import type { MandalaPaths } from "$lib/shared/mandala/domain/mandala-types";

// === From IStickerSheetPdfExporter ===

export interface StickerMandalaLookup {
  /** Return pre-computed MandalaPaths for a primitive key (shapeHash in v2). */
  getPaths(primitiveKey: string): MandalaPaths | null;
}

// === From IStickerSheetPdfExporter ===

export interface StickerMandalaLookup {
  /** Return pre-computed MandalaPaths for a primitive key (shapeHash in v2). */
  getPaths(primitiveKey: string): MandalaPaths | null;
}
