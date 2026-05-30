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

export interface AssetBundle {
  keys: string[];
  bitmaps: ImageBitmap[];               // index-aligned with keys
  grids: LoadedAssets["grids"];         // four grid drawables (ImageBitmap | null)
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

  return { keys, bitmaps, grids };
}

/** Collect every transferable in a bundle (for postMessage transfer list). */
export function bundleTransferables(bundle: AssetBundle): Transferable[] {
  const t: Transferable[] = [...bundle.bitmaps];
  for (const v of Object.values(bundle.grids)) if (v) t.push(v);
  return t;
}

/** WORKER (or any) THREAD. Populate a cache + loader from a received bundle. */
export function seedCachesFromBundle(
  bundle: AssetBundle,
  cache = getSvgImageCache(),
  loader = getSvgAssetLoader(),
): void {
  for (let i = 0; i < bundle.keys.length; i++) {
    cache.setImage(bundle.keys[i]!, bundle.bitmaps[i]!);
  }
  loader.seedGrids(bundle.grids);
}
