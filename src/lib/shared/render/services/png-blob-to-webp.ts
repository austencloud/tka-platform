/**
 * Convert a PNG blob to WebP for compact cloud storage. Falls back to returning
 * the input unchanged if encoding is unavailable (SSR / unsupported), so an
 * upload path can never throw on conversion.
 */
import { blobToImage } from "./image-format-converter";

export async function pngBlobToWebp(
  png: Blob,
  quality = 0.9,
  decodeTimeoutMs?: number
): Promise<Blob> {
  if (typeof document === "undefined" && typeof OffscreenCanvas === "undefined") {
    return png;
  }
  try {
    const img = await blobToImage(png, decodeTimeoutMs);
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;

    if (typeof OffscreenCanvas !== "undefined") {
      const canvas = new OffscreenCanvas(w, h);
      const ctx = canvas.getContext("2d");
      if (!ctx) return png;
      ctx.drawImage(img, 0, 0);
      return await canvas.convertToBlob({ type: "image/webp", quality });
    }

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return png;
    ctx.drawImage(img, 0, 0);
    return await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b ?? png), "image/webp", quality);
    });
  } catch {
    return png;
  }
}
