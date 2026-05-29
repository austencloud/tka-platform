import type { GlyphImageData } from "@tka/render-composition";

export interface GlyphBitmapEntry {
  letter: string;
  bitmap: ImageBitmap;
  naturalWidth: number;
  naturalHeight: number;
  isDash: boolean;
}

export async function convertGlyphCacheToBitmaps(
  cache: Map<string, GlyphImageData>
): Promise<GlyphBitmapEntry[]> {
  const entries: GlyphBitmapEntry[] = [];

  await Promise.all(
    Array.from(cache.entries()).map(async ([letter, data]) => {
      try {
        const bitmap = await createImageBitmap(data.image as HTMLImageElement);
        entries.push({
          letter,
          bitmap,
          naturalWidth: data.naturalWidth,
          naturalHeight: data.naturalHeight,
          isDash: data.isDash,
        });
      } catch {
        // Non-fatal — glyph will be missing in worker renders
      }
    })
  );

  return entries;
}
