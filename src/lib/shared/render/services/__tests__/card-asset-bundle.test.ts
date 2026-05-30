import { describe, it, expect } from "vitest";
import { seedCachesFromBundle, type AssetBundle } from "../card-asset-bundle";
import { SvgImageCache } from "../svg-image-cache";
import { SvgAssetLoader } from "../svg-asset-loader";

describe("seedCachesFromBundle", () => {
  it("populates a cache + loader from a bundle", () => {
    const cache = new SvgImageCache();
    const loader = new SvgAssetLoader();
    const bmpA = { width: 1, height: 1 } as unknown as ImageBitmap;
    const bmpGrid = { width: 950, height: 950 } as unknown as ImageBitmap;
    const bundle: AssetBundle = {
      keys: ["arrow_blue_exp_123"],
      bitmaps: [bmpA],
      grids: { diamond: bmpGrid, box: null, diamondNonRadial: null, boxNonRadial: null },
    };
    seedCachesFromBundle(bundle, cache, loader);
    expect(cache.entries().get("arrow_blue_exp_123")).toBe(bmpA);
    expect(loader.getGridImage("diamond")).toBe(bmpGrid);
  });
});
