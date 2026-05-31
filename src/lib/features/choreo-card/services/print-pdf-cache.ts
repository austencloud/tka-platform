// Built-PDF blob cache for the deck print pipeline.
//
// exportHomePrintPDF re-encodes every card canvas to PNG and rebuilds the whole
// pdf-lib document on each call — the "Preparing…" wait. The bytes are a pure
// function of (deck content + order, card size, copies, grouping, mode, deck
// name, theme, prop types), so an identical request re-prints the exact same
// file. This caches that blob: print fronts → print backs → print fronts again
// rebuilds nothing the second time, and re-opening a deck printed moments ago
// (same content key) is instant.

import type { CardPair } from "./types";
import {
  exportHomePrintPDF,
  type PrintPDFMode,
  type HomePrintOptions,
} from "./print-pdf-exporter";
import type { CardSizeId } from "../domain/card-sizes";

// Blobs run a few MB each; keep a handful so a session of side/mode/deck
// switching all stays warm without unbounded growth.
const CACHE_LIMIT = 16;
const blobCache = new Map<string, Blob>();

/**
 * Build (or reuse) the print PDF for a deck + mode + layout.
 *
 * `key` MUST encode every input that changes the PDF bytes — deck content and
 * order, card size, copies, grouping, mode, deck name, theme, and prop types.
 * If two distinct renders can collide on `key`, the wrong blob is served, so the
 * caller owns building it from the same inputs that drive the render.
 */
export async function getOrBuildPrintPDF(
  key: string,
  pairs: CardPair[],
  deckName: string,
  cardSize: CardSizeId,
  mode: PrintPDFMode,
  options: HomePrintOptions,
  onProgress?: (current: number, total: number) => void,
): Promise<Blob> {
  const hit = blobCache.get(key);
  if (hit) {
    // Refresh recency so a re-print keeps the entry from aging out under churn.
    blobCache.delete(key);
    blobCache.set(key, hit);
    return hit;
  }

  const blob = await exportHomePrintPDF(pairs, deckName, cardSize, onProgress, mode, options);
  blobCache.set(key, blob);
  if (blobCache.size > CACHE_LIMIT) {
    const oldest = blobCache.keys().next().value;
    if (oldest !== undefined) blobCache.delete(oldest);
  }
  return blob;
}
