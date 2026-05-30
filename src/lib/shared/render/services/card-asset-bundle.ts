// src/lib/shared/render/services/card-asset-bundle.ts
//
// AssetBundle: a transferable snapshot of every decoded SVG the worker pool
// needs. Built on the MAIN THREAD after a prepare-pass populates the caches;
// seeded into each worker so it NEVER calls createImageBitmap(svgBlob) (which
// fails on the app's SVGs in worker scope).

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import { getSvgImageCache, type DrawableImage } from "./svg-image-cache";
import { getSvgAssetLoader } from "./svg-asset-loader";
import type { LoadedAssets } from "./svg-asset-loader";
import {
  buildGlyphBitmapSeed,
  SeededGlyphSource,
  type GlyphBitmapSeed,
} from "./glyph-bitmap-seed";
import type { TextRenderer } from "./text-renderer";

export interface AssetBundle {
  keys: string[];
  bitmaps: ImageBitmap[];               // index-aligned with keys
  grids: LoadedAssets["grids"];         // four grid drawables (ImageBitmap | null)
  glyphs: GlyphBitmapSeed;              // header word-glyph bitmaps (keys index-aligned with bitmaps)
}

// Square fallback raster size for a dimensionless SVG (TKA pictograph assets +
// grids are authored on a square viewBox, so a square snapshot is correct).
const ASSET_SNAPSHOT_SIZE = 950;

/** Re-decode any DrawableImage (HTMLImageElement | ImageBitmap) to an ImageBitmap. */
async function toBitmap(img: DrawableImage | null): Promise<ImageBitmap | null> {
  if (!img) return null;
  try {
    return await createImageBitmap(img as ImageBitmapSource);
  } catch {
    // A viewBox-only SVG HTMLImageElement has no intrinsic size, so the bare
    // createImageBitmap above throws InvalidStateError. Retry with explicit
    // resize options (using natural dims when present, else a square canonical
    // size) so the bundle never silently starves the worker pool.
    try {
      const el = img as HTMLImageElement;
      const w = el.naturalWidth || el.width || ASSET_SNAPSHOT_SIZE;
      const h = el.naturalHeight || el.height || ASSET_SNAPSHOT_SIZE;
      return await createImageBitmap(img as ImageBitmapSource, {
        resizeWidth: w,
        resizeHeight: h,
        resizeQuality: "high",
      });
    } catch (e) {
      console.warn("[card-asset-bundle] skipping un-decodable cache entry:", e);
      return null;
    }
  }
}

/**
 * MAIN THREAD. Runs a prepare-pass over the deck to warm the singleton svgCache
 * + svgAssetLoader, then snapshots them as transferable ImageBitmaps.
 *
 * `prepareDeck` is injected (defaults to the real preparer wiring) so the heavy
 * pictograph-preparer import isn't pulled into worker/unit bundles.
 */
export async function buildAssetBundle(
  sequences: SequenceData[],
  opts: { bluePropType: PropType; redPropType: PropType; theme: string },
  prepareDeck: (seqs: SequenceData[], o: typeof opts) => Promise<void>,
): Promise<AssetBundle> {
  await prepareDeck(sequences, opts);

  const cache = getSvgImageCache();
  const loader = getSvgAssetLoader();

  const snapshot = cache.entries();
  const keys: string[] = [];
  const bitmaps: ImageBitmap[] = [];
  for (const [key, drawable] of snapshot) {
    const bmp = await toBitmap(drawable);
    if (bmp) { keys.push(key); bitmaps.push(bmp); }
  }

  const g = loader.snapshotGrids();
  const grids: LoadedAssets["grids"] = {
    diamond: await toBitmap(g.diamond),
    box: await toBitmap(g.box),
    diamondNonRadial: await toBitmap(g.diamondNonRadial),
    boxNonRadial: await toBitmap(g.boxNonRadial),
  };

  // Header word-glyph bitmaps. Built on the main thread (buildGlyphBitmapSeed
  // dynamic-imports the $env-coupled GlyphCache); transferred into the worker
  // and re-attached to a SeededGlyphSource so the worker TextRenderer can paint
  // the TKA word header without touching get-glyph-cache.
  const glyphs = await buildGlyphBitmapSeed(sequences);

  return { keys, bitmaps, grids, glyphs };
}

/** Collect every transferable in a bundle (for postMessage transfer list). */
export function bundleTransferables(bundle: AssetBundle): Transferable[] {
  const t: Transferable[] = [...bundle.bitmaps];
  for (const v of Object.values(bundle.grids)) if (v) t.push(v);
  t.push(...bundle.glyphs.bitmaps);
  return t;
}

/**
 * WORKER (or any) THREAD. Populate a cache + loader from a received bundle and
 * construct a SeededGlyphSource from the bundle's header glyphs.
 *
 * Returns the SeededGlyphSource so the caller (the worker seed handler — a later
 * task) can inject it into the worker's TextRenderer via
 * `textRenderer.setGlyphSource(source)`. seedCachesFromBundle deliberately does
 * NOT reach the worker's TextRenderer instance itself: the worker owns that
 * singleton and wires it at init, and keeping this function free of a
 * TextRenderer dependency keeps the SVG-cache seed and the glyph seed
 * independently testable. (The TextRenderer type import is type-only — no
 * runtime/worker-graph cost.)
 */
export function seedCachesFromBundle(
  bundle: AssetBundle,
  cache = getSvgImageCache(),
  loader = getSvgAssetLoader(),
): SeededGlyphSource {
  for (let i = 0; i < bundle.keys.length; i++) {
    cache.setImage(bundle.keys[i]!, bundle.bitmaps[i]!);
  }
  loader.seedGrids(bundle.grids);

  const glyphSource = new SeededGlyphSource();
  glyphSource.seed(bundle.glyphs);
  return glyphSource;
}

/**
 * Convenience wiring for callers that DO hold the worker's TextRenderer:
 * seed the SVG caches + grids AND inject the glyph source into the renderer in
 * one call. The worker seed handler can use this instead of threading the
 * returned source manually.
 */
export function seedRendererFromBundle(
  bundle: AssetBundle,
  textRenderer: Pick<TextRenderer, "setGlyphSource">,
  cache = getSvgImageCache(),
  loader = getSvgAssetLoader(),
): void {
  const glyphSource = seedCachesFromBundle(bundle, cache, loader);
  textRenderer.setGlyphSource(glyphSource);
}
