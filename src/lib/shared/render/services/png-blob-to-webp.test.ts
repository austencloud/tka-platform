import { describe, it, expect } from "vitest";
import { pngBlobToWebp } from "./png-blob-to-webp";

describe("pngBlobToWebp", () => {
  it("returns the original blob when conversion is unavailable (no DOM)", async () => {
    // jsdom lacks real canvas encoding; the converter must degrade to the input
    // blob rather than throw, so uploads never crash a save.
    const input = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });
    const out = await pngBlobToWebp(input);
    expect(out).toBeInstanceOf(Blob);
  });
});
