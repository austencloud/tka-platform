/**
 * Tests for the constant card-back element rasterizer CACHE logic.
 *
 * Real DOM rasterization (modern-screenshot + createImageBitmap) does not run
 * in vitest/jsdom, so we inject a fake rasterize function via
 * __setRasterizeFnForTest and assert the caching behavior only:
 *   - second call with same key does NOT re-invoke the underlying rasterizer
 *   - different keys DO invoke it again
 *   - clearCardBackConstantCache() resets, closes bitmaps, and forces re-raster
 *
 * The real visual/parity check happens in the browser harness (P1.7).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  rasterizeBrand,
  rasterizeUrl,
  rasterizeDifficultyBadge,
  rasterizeLoopIcon,
  rasterizeLoopIconByKind,
  clearCardBackConstantCache,
  __setRasterizeFnForTest,
} from "../card-back-bitmaps-constant";

// A fake ImageBitmap with a spy-able close(); enough to satisfy the cache.
function makeFakeBitmap(): { close: () => void } {
  return { close: vi.fn() };
}

describe("card-back-bitmaps-constant cache", () => {
  let calls: number;

  beforeEach(() => {
    calls = 0;
    const fakeRasterize = async (): Promise<ImageBitmap> => {
      calls += 1;
      return makeFakeBitmap() as unknown as ImageBitmap;
    };
    __setRasterizeFnForTest(fakeRasterize);
    clearCardBackConstantCache();
  });

  afterEach(() => {
    __setRasterizeFnForTest(null);
    clearCardBackConstantCache();
  });

  describe("rasterizeBrand", () => {
    it("rasterizes once per theme; same theme is cached", async () => {
      await rasterizeBrand("ocean");
      await rasterizeBrand("ocean");
      expect(calls).toBe(1);
    });

    it("returns the same promise/bitmap for the same key", async () => {
      const a = rasterizeBrand("ocean");
      const b = rasterizeBrand("ocean");
      expect(a).toBe(b);
      expect(await a).toBe(await b);
    });

    it("rasterizes again for a different theme", async () => {
      await rasterizeBrand("ocean");
      await rasterizeBrand("ember");
      expect(calls).toBe(2);
    });
  });

  describe("rasterizeUrl", () => {
    it("caches per theme", async () => {
      await rasterizeUrl("cosmic");
      await rasterizeUrl("cosmic");
      expect(calls).toBe(1);
      await rasterizeUrl("forest");
      expect(calls).toBe(2);
    });

    it("brand and url caches are independent", async () => {
      await rasterizeBrand("ocean");
      await rasterizeUrl("ocean");
      expect(calls).toBe(2);
    });
  });

  describe("rasterizeDifficultyBadge", () => {
    it("caches per level", async () => {
      await rasterizeDifficultyBadge(1);
      await rasterizeDifficultyBadge(1);
      expect(calls).toBe(1);
      await rasterizeDifficultyBadge(2);
      await rasterizeDifficultyBadge(3);
      expect(calls).toBe(3);
    });
  });

  describe("rasterizeLoopIcon", () => {
    it("caches per (component,color,quarteredRot,quarteredInv) key", async () => {
      await rasterizeLoopIcon("rotated", "#36c3ff", {});
      await rasterizeLoopIcon("rotated", "#36c3ff", {});
      expect(calls).toBe(1);
    });

    it("quartered variants are distinct cache entries", async () => {
      await rasterizeLoopIcon("rotated", "#36c3ff", {});
      await rasterizeLoopIcon("rotated", "#36c3ff", { quarteredRot: true });
      expect(calls).toBe(2);
    });

    it("inverted quartered differs from plain inverted", async () => {
      await rasterizeLoopIcon("inverted", "#eb7d00", {});
      await rasterizeLoopIcon("inverted", "#eb7d00", { quarteredInv: true });
      expect(calls).toBe(2);
    });

    it("different color is a different cache entry", async () => {
      await rasterizeLoopIcon("flipped", "#e91e63", {});
      await rasterizeLoopIcon("flipped", "#ffffff", {});
      expect(calls).toBe(2);
    });
  });

  describe("rasterizeLoopIconByKind", () => {
    it("caches per (kind,fa,color) key — no per-card mount", async () => {
      await rasterizeLoopIconByKind("fa", "fas fa-rotate", "#36c3ff");
      await rasterizeLoopIconByKind("fa", "fas fa-rotate", "#36c3ff");
      expect(calls).toBe(1);
    });

    it("different kind / fa / color are distinct cache entries", async () => {
      await rasterizeLoopIconByKind("swap", "", "#2ecc71");
      await rasterizeLoopIconByKind("checkerboard", "", "#eb7d00");
      await rasterizeLoopIconByKind("fa", "fas fa-rotate", "#36c3ff");
      await rasterizeLoopIconByKind("fa", "fas fa-rotate", "#ffffff");
      expect(calls).toBe(4);
    });

    it("shares the loop-icon cache with rasterizeLoopIcon (cleared together)", async () => {
      await rasterizeLoopIconByKind("fa", "fas fa-rotate", "#36c3ff");
      expect(calls).toBe(1);
      clearCardBackConstantCache();
      await rasterizeLoopIconByKind("fa", "fas fa-rotate", "#36c3ff");
      expect(calls).toBe(2);
    });
  });

  describe("clearCardBackConstantCache", () => {
    it("closes resolved bitmaps and forces re-rasterization", async () => {
      const bmp = (await rasterizeBrand("ocean")) as unknown as { close: ReturnType<typeof vi.fn> };
      expect(calls).toBe(1);

      clearCardBackConstantCache();
      // microtask turn so the .then(close) inside clear runs
      await Promise.resolve();
      await Promise.resolve();
      expect(bmp.close).toHaveBeenCalledTimes(1);

      await rasterizeBrand("ocean");
      expect(calls).toBe(2);
    });

    it("clears every cache type", async () => {
      await rasterizeBrand("ocean");
      await rasterizeUrl("ocean");
      await rasterizeDifficultyBadge(1);
      await rasterizeLoopIcon("rotated", "#36c3ff", {});
      expect(calls).toBe(4);

      clearCardBackConstantCache();

      await rasterizeBrand("ocean");
      await rasterizeUrl("ocean");
      await rasterizeDifficultyBadge(1);
      await rasterizeLoopIcon("rotated", "#36c3ff", {});
      expect(calls).toBe(8);
    });
  });
});
