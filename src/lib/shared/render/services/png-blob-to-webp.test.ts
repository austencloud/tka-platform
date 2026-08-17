import { describe, it, expect } from "vitest";
import { pngBlobToWebp } from "./png-blob-to-webp";

describe("pngBlobToWebp", () => {
  it("returns the original blob when the image never decodes", async () => {
    // jsdom fires neither `load` nor `error` for an object URL, so the decode
    // hangs rather than throwing. That is exactly the case the bounded wait in
    // `blobToImage` exists for: the converter must degrade to the input blob so
    // an upload can never hang or crash a save. A short timeout keeps this a
    // unit test; production uses the 15s default.
    const input = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });

    const out = await pngBlobToWebp(input, 0.9, 50);

    expect(out).toBe(input);
  });
});
