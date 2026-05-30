import { describe, it, expect } from "vitest";
import { seedCachesFromBundle, type AssetBundle } from "../card-asset-bundle";
import { SvgImageCache } from "../svg-image-cache";
import { SvgAssetLoader } from "../svg-asset-loader";

describe("seedCachesFromBundle", () => {
  it("populates a cache + loader from a bundle and returns a seeded glyph source", () => {
    const cache = new SvgImageCache();
    const loader = new SvgAssetLoader();
    const bmpA = { width: 1, height: 1 } as unknown as ImageBitmap;
    const bmpGrid = { width: 950, height: 950 } as unknown as ImageBitmap;
    const bmpGlyph = { width: 80, height: 100 } as unknown as ImageBitmap;
    const bmpGlyphDash = { width: 80, height: 100 } as unknown as ImageBitmap;
    const bundle: AssetBundle = {
      keys: ["arrow_blue_exp_123"],
      bitmaps: [bmpA],
      grids: { diamond: bmpGrid, box: null, diamondNonRadial: null, boxNonRadial: null },
      glyphs: { keys: ["A", "W-"], bitmaps: [bmpGlyph, bmpGlyphDash] },
    };
    const glyphSource = seedCachesFromBundle(bundle, cache, loader);
    expect(cache.entries().get("arrow_blue_exp_123")).toBe(bmpA);
    expect(loader.getGridImage("diamond")).toBe(bmpGrid);

    const a = glyphSource.get("A");
    expect(a?.image).toBe(bmpGlyph);
    expect(a?.naturalWidth).toBe(80);
    expect(a?.naturalHeight).toBe(100);
    expect(a?.isDash).toBe(false);

    const dash = glyphSource.get("W-");
    expect(dash?.image).toBe(bmpGlyphDash);
    expect(dash?.isDash).toBe(true);
  });
});
