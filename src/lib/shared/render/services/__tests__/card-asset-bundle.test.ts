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
    // Bitmaps rasterize to a SQUARE canonical snapshot (512x512). The glyphs'
    // TRUE source viewBox dims are non-square (A.svg ≈ 0.75:1, W-.svg ≈ 1.89:1).
    // The seeded GlyphImageData MUST carry the SOURCE dims, not the bitmap's, or
    // the aspect-ratio-driven header layout distorts every non-square glyph.
    const bmpGlyph = { width: 512, height: 512 } as unknown as ImageBitmap;
    const bmpGlyphDash = { width: 512, height: 512 } as unknown as ImageBitmap;
    const bundle: AssetBundle = {
      keys: ["arrow_blue_exp_123"],
      bitmaps: [bmpA],
      grids: { diamond: bmpGrid, box: null, diamondNonRadial: null, boxNonRadial: null },
      glyphs: {
        keys: ["A", "W-"],
        bitmaps: [bmpGlyph, bmpGlyphDash],
        // Source viewBox dims, differing from the square 512x512 bitmaps.
        naturalWidths: [75, 189],
        naturalHeights: [100, 100],
      },
    };
    const glyphSource = seedCachesFromBundle(bundle, cache, loader);
    expect(cache.entries().get("arrow_blue_exp_123")).toBe(bmpA);
    expect(loader.getGridImage("diamond")).toBe(bmpGrid);

    const a = glyphSource.get("A");
    expect(a?.image).toBe(bmpGlyph);
    // Natural dims come from the SOURCE viewBox arrays, NOT the 512x512 bitmap.
    expect(a?.naturalWidth).toBe(75);
    expect(a?.naturalHeight).toBe(100);
    expect(a?.naturalWidth).not.toBe(bmpGlyph.width);
    expect(a?.isDash).toBe(false);

    const dash = glyphSource.get("W-");
    expect(dash?.image).toBe(bmpGlyphDash);
    expect(dash?.naturalWidth).toBe(189);
    expect(dash?.naturalHeight).toBe(100);
    expect(dash?.isDash).toBe(true);
  });
});
