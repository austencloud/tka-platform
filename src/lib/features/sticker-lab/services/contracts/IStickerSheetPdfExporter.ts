import type { StickerSheet } from "../../domain/sticker-types";
import type { MandalaPaths } from "$lib/shared/mandala/domain/mandala-types";

export interface StickerMandalaLookup {
  /** Return the pre-computed MandalaPaths for a given sequence id. */
  getPaths(sequenceId: string): MandalaPaths | null;
}

export interface IStickerSheetPdfExporter {
  /**
   * Generate a PDF Uint8Array for the given sheet. The lookup provides pre-computed
   * MandalaPaths per sequence id (injected by the caller so this service doesn't
   * depend on the sequence repository).
   */
  export(sheet: StickerSheet, lookup: StickerMandalaLookup): Promise<Uint8Array>;
}
