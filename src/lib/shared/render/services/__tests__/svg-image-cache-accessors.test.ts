import { describe, it, expect, beforeEach } from "vitest";
import { SvgImageCache } from "../svg-image-cache";

describe("SvgImageCache accessors", () => {
  let cache: SvgImageCache;
  beforeEach(() => { cache = new SvgImageCache(); });

  it("setImage stores a drawable retrievable synchronously via entries()", () => {
    const fake = { width: 10, height: 10 } as unknown as ImageBitmap;
    cache.setImage("k1", fake);
    const entries = cache.entries();
    expect(entries.get("k1")).toBe(fake);
  });

  it("getImage returns a setImage-seeded entry without decoding", async () => {
    const fake = { width: 5, height: 5 } as unknown as ImageBitmap;
    cache.setImage("seed-key", fake);
    const got = await cache.getImage("<svg/>", "seed-key");
    expect(got).toBe(fake);
  });
});
