import { describe, it, expect } from "vitest";
import { QrImageCache, getQrImageCache } from "../qr-image-cache";

// browser=false in tests → memory layer only (IDB skipped). Covers the
// per-session dedup of QR SVG renders.

describe("QrImageCache (memory layer)", () => {
  it("returns null for a miss", async () => {
    const cache = new QrImageCache();
    expect(await cache.get("nope")).toBeNull();
  });

  it("round-trips svg + dataUrl", async () => {
    const cache = new QrImageCache();
    const value = { svg: "<svg/>", dataUrl: "data:image/svg+xml;base64,PHN2Zy8+" };
    await cache.set("k", value);
    expect(await cache.get("k")).toEqual(value);
  });

  it("overwrites on repeat set of the same key", async () => {
    const cache = new QrImageCache();
    await cache.set("k", { svg: "<a/>", dataUrl: "d1" });
    await cache.set("k", { svg: "<b/>", dataUrl: "d2" });
    expect(await cache.get("k")).toEqual({ svg: "<b/>", dataUrl: "d2" });
  });

  it("clear drops memory entries", async () => {
    const cache = new QrImageCache();
    await cache.set("k", { svg: "<a/>", dataUrl: "d" });
    await cache.clear();
    expect(await cache.get("k")).toBeNull();
  });

  it("getQrImageCache returns a stable singleton", () => {
    expect(getQrImageCache()).toBe(getQrImageCache());
  });
});
