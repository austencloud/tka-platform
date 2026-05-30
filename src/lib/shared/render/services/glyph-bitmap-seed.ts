// src/lib/shared/render/services/glyph-bitmap-seed.ts
//
// GlyphBitmapSeed: a transferable snapshot of the header-glyph images every
// (simplified) word in a deck needs. Built on the MAIN THREAD (where the
// $env-coupled GlyphCache is available), then transferred into the worker so a
// worker-side TextRenderer can paint the TKA word header WITHOUT importing
// get-glyph-cache (which pulls $app/environment at module scope and crashes a
// worker on import).
//
// Mirrors the card-asset-bundle.ts seed pattern (decoded images → transferable
// ImageBitmaps seeded into worker caches), but for the word-header glyphs.
//
// IMPORTANT — worker safety: this module is allowed to appear in the worker's
// static import graph (seedCachesFromBundle imports SeededGlyphSource from
// here). It MUST therefore never statically import get-glyph-cache. The only
// reference to the glyph cache is a DYNAMIC import inside buildGlyphBitmapSeed
// (a main-thread-only function), which keeps the $env module out of the
// worker's static graph.

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { GlyphImageData } from "@tka/render-composition";
import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
import { tokenizeWord } from "$lib/shared/pictograph/tka-glyph/utils/word-tokenizer";

/**
 * Transferable snapshot of header glyphs. `keys`, `bitmaps`, `naturalWidths`,
 * and `naturalHeights` are all index-aligned.
 *
 * `naturalWidths`/`naturalHeights` carry the glyph's TRUE source (viewBox)
 * dimensions captured from the decoded HTMLImageElement — NOT the rasterized
 * bitmap's dims. TKA letter glyphs are non-square viewBox-only SVGs (e.g. A.svg
 * ≈ 0.75:1, W-.svg ≈ 1.89:1) but rasterize to a square canonical snapshot, so
 * the header layout (`scale = availableH / naturalHeight; glyphW = naturalWidth
 * * scale`) MUST use the source dims or every non-square glyph is distorted.
 * This mirrors the GlyphTransferEntry contract in composition-dispatcher.ts,
 * which likewise carries naturalWidth/naturalHeight from the source
 * GlyphImageData, never from the bitmap.
 */
export interface GlyphBitmapSeed {
  keys: string[];
  bitmaps: ImageBitmap[];
  naturalWidths: number[];
  naturalHeights: number[];
}

// Fallback raster size for a dimensionless (viewBox-only) glyph SVG. Letter
// glyphs are authored on a 200x100-ish wide viewBox, but a square canonical
// snapshot preserves enough resolution. The natural aspect ratio is NOT read
// from the bitmap (which may be square) — it is carried separately in the seed
// as naturalWidths/naturalHeights captured from the source HTMLImageElement,
// exactly as TextRenderer.preloadGlyphImages does. Matches card-asset-bundle.ts.
const GLYPH_SNAPSHOT_SIZE = 512;

/**
 * Convert a glyph image (HTMLImageElement from the main-thread GlyphCache) to a
 * transferable ImageBitmap. Mirrors `toBitmap` in card-asset-bundle.ts: the bare
 * createImageBitmap throws InvalidStateError on viewBox-only SVGs (no intrinsic
 * size), so retry with explicit resize options. Skip + warn on total failure so
 * one bad glyph never starves the header.
 */
async function glyphToBitmap(img: HTMLImageElement): Promise<ImageBitmap | null> {
  try {
    return await createImageBitmap(img);
  } catch {
    try {
      const w = img.naturalWidth || img.width || GLYPH_SNAPSHOT_SIZE;
      const h = img.naturalHeight || img.height || GLYPH_SNAPSHOT_SIZE;
      return await createImageBitmap(img, {
        resizeWidth: w,
        resizeHeight: h,
        resizeQuality: "high",
      });
    } catch (e) {
      console.warn("[glyph-bitmap-seed] skipping un-decodable glyph:", e);
      return null;
    }
  }
}

/**
 * Load a single glyph as an HTMLImageElement from a data URL. Mirrors the
 * main-thread decode in TextRenderer.preloadGlyphImages (new Image() + onload),
 * including the 3s timeout guard so a hung load never blocks the seed build.
 */
function loadGlyphImage(dataUrl: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 3000);
    const img = new Image();
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = dataUrl;
  });
}

/**
 * Determine the exact set of glyph lookup keys the header renderer will request
 * for the given sequences, mirroring how TextRenderer derives them:
 *   1. rawWord = sequence.word (or letters joined) — same as card-front-assembler
 *   2. simplifyRepeatedWord(rawWord) — the displayed word (card-front-assembler:96)
 *   3. tokenizeWord(displayWord) — each token IS the glyph cache key
 *      (TextRenderer.buildGlyphMap keys glyphImageCache by these tokens)
 * Deduped across all sequences.
 *
 * Custom-name coverage: the header actually renders `options.customName ||
 * derivedWord` (card-front-assembler.ts:367). `options.customName` is a
 * render-time UI override not available here (the seed input is SequenceData[]
 * only), but the PERSISTED custom name lives on SequenceData.displayName (and
 * the user's intended word on SequenceData.intendedWord). We tokenize those too
 * so a saved custom-name deck card has its header glyphs seeded. A one-off
 * render-time customName that matches neither the derived word nor the persisted
 * displayName still falls back (the worker header path will simply have no glyph
 * for an un-seeded token — see SeededGlyphSource.get returning undefined).
 */
function collectGlyphKeys(sequences: SequenceData[]): string[] {
  const keys = new Set<string>();
  const addWord = (word: string | undefined): void => {
    if (!word) return;
    for (const token of tokenizeWord(simplifyRepeatedWord(word))) {
      if (token) keys.add(token);
    }
  };
  for (const seq of sequences) {
    const rawWord =
      seq.word ||
      (seq.steps ?? [])
        .filter((step) => step.letter)
        .map((step) => step.letter)
        .join("");
    addWord(rawWord);
    addWord(seq.displayName);
    addWord(seq.intendedWord);
  }
  return [...keys];
}

/**
 * MAIN THREAD. Build a transferable snapshot of every header glyph the
 * (simplified) words in `sequences` need. Uses the $env-coupled GlyphCache via
 * a DYNAMIC import so this module stays worker-safe in any static import graph.
 */
export async function buildGlyphBitmapSeed(
  sequences: SequenceData[],
): Promise<GlyphBitmapSeed> {
  const wanted = collectGlyphKeys(sequences);
  if (wanted.length === 0)
    return { keys: [], bitmaps: [], naturalWidths: [], naturalHeights: [] };

  // Dynamic import keeps get-glyph-cache (→ $app/environment) out of any
  // worker static graph that transitively reaches this module.
  const { getGlyphCache } = await import("../get-glyph-cache");
  const cache = getGlyphCache();
  await cache.initialize();

  const keys: string[] = [];
  const bitmaps: ImageBitmap[] = [];
  const naturalWidths: number[] = [];
  const naturalHeights: number[] = [];

  await Promise.all(
    wanted.map(async (key) => {
      const dataUrl = cache.getGlyphDataUrl(key);
      if (!dataUrl) return;
      const img = await loadGlyphImage(dataUrl);
      if (!img) return;
      // Capture the TRUE source dims from the decoded HTMLImageElement BEFORE
      // rasterizing — exactly as TextRenderer.preloadGlyphImages does
      // (text-renderer.ts:111-112). The bitmap may be a square canonical
      // snapshot, so its dims are NOT the glyph's natural aspect ratio.
      const naturalWidth = img.naturalWidth;
      const naturalHeight = img.naturalHeight;
      const bmp = await glyphToBitmap(img);
      if (!bmp) return;
      keys.push(key);
      bitmaps.push(bmp);
      naturalWidths.push(naturalWidth);
      naturalHeights.push(naturalHeight);
    }),
  );

  return { keys, bitmaps, naturalWidths, naturalHeights };
}

/**
 * A glyph source backed by transferred ImageBitmaps. Worker-safe: imports
 * nothing from get-glyph-cache. Reconstructs the GlyphImageData shape the header
 * renderer needs — naturalWidth/naturalHeight from the seed's SOURCE-captured
 * arrays (NOT the bitmap's dims, which may be a square canonical snapshot and
 * would distort every non-square glyph), isDash from the key suffix (matching
 * TextRenderer.preloadGlyphImages exactly: `letter.endsWith("-")`).
 */
export class SeededGlyphSource {
  private map = new Map<string, GlyphImageData>();

  seed(seed: GlyphBitmapSeed): void {
    this.map.clear();
    for (let i = 0; i < seed.keys.length; i++) {
      const key = seed.keys[i]!;
      const bmp = seed.bitmaps[i]!;
      this.map.set(key, {
        image: bmp,
        naturalWidth: seed.naturalWidths[i]!,
        naturalHeight: seed.naturalHeights[i]!,
        isDash: key.endsWith("-"),
      });
    }
  }

  get(key: string): GlyphImageData | undefined {
    return this.map.get(key);
  }
}
